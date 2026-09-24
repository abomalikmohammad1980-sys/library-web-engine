import {archiveEntryName} from './download_attachment'

export const COLLECTION_BATCH_BYTES = 50 * 1024 * 1024
export const COLLECTION_BATCH_FILES = 20
export const COLLECTION_SINGLE_BYTES = 64 * 1024 * 1024
export interface CollectionDownloadAsset {
  id: string
  fileName: string
  bytes: number
  /** Absent when the server publishes no trusted digest; the manifest records the downloaded bytes' digest. */
  sha256?: string
  /** Returns an authorized response; callers must not bypass publication checks. */
  load(signal: AbortSignal): Promise<Response>
}
export interface CollectionDownloadBatch {
  startIndex: number
  nextIndex: number
  bytes: number
  entries: Array<{id:string;name:string;bytes:Uint8Array;sha256:string}>
}
/** Avoid one more 50–64 MiB copy immediately before Blob construction on phones. */
export function collectionDownloadContent(bytes:Uint8Array):ArrayBuffer{
 const buffer=bytes.buffer
 if(buffer instanceof ArrayBuffer&&bytes.byteOffset===0&&bytes.byteLength===buffer.byteLength)return buffer
 return bytes.slice().buffer as ArrayBuffer
}
const abort = (signal:AbortSignal) => { if(signal.aborted)throw new DOMException('Cancelled','AbortError') }

export function collectionBatchEnd(assets:readonly CollectionDownloadAsset[],start:number):number {
  if(!Number.isSafeInteger(start)||start<0||start>assets.length)throw Error('collection_cursor')
  let bytes=0,end=start
  while(end<assets.length && end-start<COLLECTION_BATCH_FILES){
    const asset=assets[end]!
    if(!Number.isSafeInteger(asset.bytes)||asset.bytes<1||asset.bytes>COLLECTION_SINGLE_BYTES)throw Error('collection_asset_size')
    if(asset.bytes>COLLECTION_BATCH_BYTES){if(end===start)throw Error('collection_single_required');break}
    if(asset.sha256!==undefined&&!/^[a-f0-9]{64}$/.test(asset.sha256))throw Error('collection_asset_digest')
    if(bytes+asset.bytes>COLLECTION_BATCH_BYTES)break
    bytes+=asset.bytes;end++
  }
  return end
}

/** Download one original too large for the ZIP batch, preserving its exact bytes. */
export async function prepareCollectionSingle(asset:CollectionDownloadAsset,signal:AbortSignal):Promise<Uint8Array>{
 abort(signal)
 if(!Number.isSafeInteger(asset.bytes)||asset.bytes<=COLLECTION_BATCH_BYTES||asset.bytes>COLLECTION_SINGLE_BYTES)throw Error('collection_asset_size')
 if(asset.sha256!==undefined&&!/^[a-f0-9]{64}$/.test(asset.sha256))throw Error('collection_asset_digest')
 const response=await asset.load(signal)
 abort(signal)
 if(!response.ok||!response.body)throw Error('collection_asset_unavailable')
 const contentLength=response.headers.get('content-length')
 if(contentLength!==null&&Number(contentLength)!==asset.bytes){await response.body.cancel();throw Error('collection_asset_length')}
 const bytes=new Uint8Array(asset.bytes),reader=response.body.getReader()
 const cancel=()=>{void reader.cancel().catch(()=>{})};signal.addEventListener('abort',cancel,{once:true})
 let offset=0
 try{
  for(;;){abort(signal);const {done,value}=await reader.read();abort(signal);if(done)break
   if(offset+value.length>bytes.length)throw Error('collection_asset_length')
   bytes.set(value,offset);offset+=value.length
  }
 }finally{signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock()}
 if(offset!==bytes.length)throw Error('collection_asset_length')
 if(asset.sha256!==undefined){
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')
  abort(signal)
  if(digest!==asset.sha256)throw Error('collection_asset_digest')
 }
 return bytes
}

/** Sequential and bounded. An incomplete batch never advances the saved cursor. */
export async function prepareCollectionBatch(
  assets:readonly CollectionDownloadAsset[],start:number,signal:AbortSignal,
  progress:(completed:number,total:number)=>void=()=>{},
):Promise<CollectionDownloadBatch>{
  abort(signal)
  const end=collectionBatchEnd(assets,start),entries:CollectionDownloadBatch['entries']=[]
  let totalBytes=0
  for(let index=start;index<end;index++){
    abort(signal)
    const asset=assets[index]!,response=await asset.load(signal)
    abort(signal)
    if(!response.ok||!response.body)throw Error('collection_asset_unavailable')
    const contentLength=response.headers.get('content-length')
    if(contentLength!==null&&Number(contentLength)!==asset.bytes){await response.body.cancel();throw Error('collection_asset_length')}
    const bytes=new Uint8Array(asset.bytes),reader=response.body.getReader();let offset=0
    const cancel=()=>{void reader.cancel().catch(()=>{})};signal.addEventListener('abort',cancel,{once:true})
    try{
      for(;;){abort(signal);const {done,value}=await reader.read();abort(signal);if(done)break
        if(offset+value.length>bytes.length)throw Error('collection_asset_length')
        bytes.set(value,offset);offset+=value.length
      }
    }finally{signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock()}
    if(offset!==bytes.length)throw Error('collection_asset_length')
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')
    abort(signal)
    if(asset.sha256!==undefined&&digest!==asset.sha256)throw Error('collection_asset_digest')
    entries.push({id:asset.id,name:`${String(index+1).padStart(5,'0')}-${archiveEntryName(asset.fileName)}`,bytes,sha256:digest})
    totalBytes+=bytes.length;progress(index-start+1,end-start)
  }
  return {startIndex:start,nextIndex:end,bytes:totalBytes,entries}
}

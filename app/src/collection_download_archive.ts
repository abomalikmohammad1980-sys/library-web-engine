import {zip,strToU8} from 'fflate'
import type {CollectionDownloadBatch} from './collection_download_batch'
import type {CollectionOriginalPlan} from './collection_originals'

/** Store, do not recompress, original bytes. One bounded batch at a time. */
export function collectionDownloadArchive(batch:CollectionDownloadBatch,options:{
 title:string;part:number;totalAvailableFiles:number;unavailable:CollectionOriginalPlan['unavailable'];signal:AbortSignal
}):Promise<Uint8Array>{
 const {signal}=options
 if(signal.aborted)return Promise.reject(new DOMException('Cancelled','AbortError'))
 const files:Record<string,Uint8Array>={}
 for(const entry of batch.entries)files[entry.name]=entry.bytes
 files['manifest.json']=strToU8(JSON.stringify({format:'khizana-original-files',version:1,collection:options.title,part:options.part,originalsOnly:true,lastBatch:batch.nextIndex===options.totalAvailableFiles,totalAvailableFiles:options.totalAvailableFiles,missingOriginalCount:options.unavailable.length,range:{start:batch.startIndex,end:batch.nextIndex},files:batch.entries.map(({id,name,sha256,bytes})=>({id,name,sha256,bytes:bytes.length})),unavailable:options.unavailable},null,2))
 return new Promise((resolve,reject)=>{
  const cancel=()=>{terminate();signal.removeEventListener('abort',cancel);reject(new DOMException('Cancelled','AbortError'))}
  const terminate=zip(files,{level:0},(error,result)=>{signal.removeEventListener('abort',cancel);if(error)reject(error);else if(signal.aborted)reject(new DOMException('Cancelled','AbortError'));else resolve(result)})
  signal.addEventListener('abort',cancel,{once:true})
 })
}

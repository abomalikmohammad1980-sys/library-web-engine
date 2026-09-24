import {localOriginalAsset,type CardAssetBook} from './library_card_state'
import type {CollectionDownloadAsset} from './collection_download_batch'
export interface CollectionOriginalBook extends CardAssetBook {
  id:string
  title:string
  volumes?:Array<CardAssetBook & {number:number}>
}
export interface CollectionOriginalPlan {
  assets:CollectionDownloadAsset[]
  unavailable:Array<{id:string;title:string;reason:'missing'|'original_unavailable'|'load_failed'|'size_limit'}>
}
/** A large original must not prevent the smaller originals in the same collection from being saved. */
export function boundCollectionOriginals(plan:CollectionOriginalPlan,maxBytes:number):CollectionOriginalPlan{
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw Error('collection_size_limit')
  const assets:CollectionDownloadAsset[]=[],unavailable=[...plan.unavailable]
  for(const asset of plan.assets){
    if(asset.bytes>maxBytes)unavailable.push({id:asset.id,title:asset.fileName,reason:'size_limit'})
    else assets.push(asset)
  }
  return{assets,unavailable}
}
const digest=async(bytes:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.slice().buffer as ArrayBuffer))].map(n=>n.toString(16).padStart(2,'0')).join('')
const originalAsset=(source:CardAssetBook,fallback:CardAssetBook['sourceFormat'])=>{
  const sourceFormat=source.sourceFormat??fallback
  return localOriginalAsset({...source,...(sourceFormat===undefined?{}:{sourceFormat})})
}

/** No reading JSON, generated PDF, reconstructed BOK or extracted text fallback. */
export async function planCollectionOriginals(
  refs:readonly {id:string;title:string}[],
  resolve:(id:string,signal:AbortSignal)=>Promise<CollectionOriginalBook|undefined>,
  signal:AbortSignal,
  isCurrent:()=>boolean,
  remote?:(id:string,signal:AbortSignal)=>Promise<CollectionDownloadAsset[]>,
):Promise<CollectionOriginalPlan>{
  const assets:CollectionDownloadAsset[]=[],unavailable:CollectionOriginalPlan['unavailable']=[]
  const active=()=>{if(signal.aborted||!isCurrent())throw new DOMException('Cancelled','AbortError')}
  const seen=new Set<string>()
  for(const ref of refs){
    active();if(seen.has(ref.id))continue;seen.add(ref.id)
    if(ref.id.startsWith('central-submission:')&&remote){
      try{const available=await remote(ref.id.slice('central-submission:'.length),signal);active();assets.push(...available)}
      catch{active();unavailable.push({id:ref.id,title:ref.title,reason:'load_failed'})}
      continue
    }
    let book:CollectionOriginalBook|undefined
    try{book=await resolve(ref.id,signal)}catch{active();unavailable.push({id:ref.id,title:ref.title,reason:'load_failed'});continue}
    active()
    if(!book){unavailable.push({id:ref.id,title:ref.title,reason:'missing'});continue}
    const sources=book.volumes?.length?[...book.volumes].sort((a,b)=>a.number-b.number):[{...book,number:0}]
    const originals=sources.map(source=>originalAsset(source,book.sourceFormat))
    // A partially available multi-volume book is never silently labelled complete.
    if(originals.some(source=>!source)){unavailable.push({id:ref.id,title:ref.title,reason:'original_unavailable'});continue}
    for(let index=0;index<sources.length;index++){
      const source=originals[index]!,volumeNumber=sources[index]!.number,sha256=await digest(source.bytes)
      active()
      assets.push({id:`${ref.id}:${volumeNumber}`,fileName:source.fileName,bytes:source.bytes.length,sha256,
        // Deliberately re-resolve later: the plan must not retain every book's bytes
        // or grant access after logout, withdrawal, or an edition replacement.
        load:async requestSignal=>{
          if(requestSignal.aborted||!isCurrent())throw new DOMException('Cancelled','AbortError')
          const current=await resolve(ref.id,requestSignal)
          if(requestSignal.aborted||!isCurrent())throw new DOMException('Cancelled','AbortError')
          const part=volumeNumber===0?current:current?.volumes?.find(v=>v.number===volumeNumber)
          const original=part&&originalAsset(part,current?.sourceFormat)
          if(!original)throw Error('collection_original_unavailable')
          return new Response(original.bytes.slice().buffer as ArrayBuffer,{headers:{'content-type':original.mimeType,'content-length':String(original.bytes.length)}})
        },
      })
    }
  }
  return {assets,unavailable}
}

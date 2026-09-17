import {validateShamelaAuthorIndex,type ShamelaAuthorIndex} from './shamela_author_index'
export const SHAMELA_AUTHOR_METADATA_SHA='3599e8be28beb809bf8b57150d02cbef6c1ca73f4dc74819ae3a319ca854fb80'
let memory:Promise<ShamelaAuthorIndex>|undefined
/** Metadata consumers must not fetch the biography catalogue, even as fallback. */
export function loadShamelaAuthorMetadata():Promise<ShamelaAuthorIndex>{
 return memory??=(async()=>{
  const response=await fetch(`./data/shamela-author-metadata.json?v=${SHAMELA_AUTHOR_METADATA_SHA}`,{cache:'force-cache',headers:{Accept:'application/json'}})
  if(!response.ok)throw Error(`shamela_author_metadata_http_${response.status}`)
  const reader=response.body?.getReader();if(!reader)throw Error('shamela_author_metadata_integrity')
  const parts:Uint8Array[]=[];let length=0
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2_000_000)throw Error('shamela_author_metadata_integrity');parts.push(value)}}finally{await reader.cancel();reader.releaseLock()}
  const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')
  if(digest!==SHAMELA_AUTHOR_METADATA_SHA)throw Error('shamela_author_metadata_integrity')
  const payload=validateShamelaAuthorIndex(JSON.parse(new TextDecoder().decode(bytes)))
  if(payload.authors.some(a=>'biography'in a||'biographyProvenance'in a))throw Error('shamela_author_metadata_integrity')
  return payload
 })().catch(error=>{memory=undefined;throw error})
}
export function resetShamelaAuthorMetadataForTests():void{memory=undefined}

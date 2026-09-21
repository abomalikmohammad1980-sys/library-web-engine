import type {StoredBook} from './engine/library_store'
import type {ShamelaPackManifestBook} from './shamela_pack_seed'
import {materializeShamelaPackBook,type PackBook} from './shamela_pack_materialize'
import {ShamelaPackSeedError} from './shamela_pack_transport'
export type PackPreparation=Pick<ShamelaPackManifestBook,'workId'|'counts'|'sha256'|'catalog'>
export function parseVerifiedShamelaPack(packed:Uint8Array,entry:PackPreparation):StoredBook{
 let parsed:PackBook
 try{parsed=JSON.parse(new TextDecoder().decode(packed))}catch(error){throw new ShamelaPackSeedError('shamela_pack_book_json_invalid',error)}
 if(parsed.workId!==entry.workId||parsed.pages?.length!==entry.counts.pages||parsed.titles?.length!==entry.counts.titles)throw new ShamelaPackSeedError('shamela_pack_book_count_mismatch')
 return materializeShamelaPackBook(parsed,packed,entry.sha256,entry.catalog.title)
}
/** Transfer, do not clone, large source bytes. Keep parsing off the UI thread. */
export async function prepareShamelaPackBook(packed:Uint8Array,entry:PackPreparation):Promise<StoredBook>{
 if(packed.byteLength<8*1024*1024||typeof Worker==='undefined')return parseVerifiedShamelaPack(packed,entry)
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./shamela_pack_prepare.worker.ts',import.meta.url),{type:'module'})
  const finish=()=>{clearTimeout(timer);worker.terminate()}
  const timer=setTimeout(()=>{finish();reject(new ShamelaPackSeedError('shamela_pack_book_preparation_timeout'))},60000)
  worker.onmessage=event=>{finish();event.data.error?reject(new ShamelaPackSeedError(event.data.error)):resolve(event.data.book)}
  worker.onerror=()=>{finish();reject(new ShamelaPackSeedError('shamela_pack_book_preparation_failed'))}
  try{worker.postMessage({packed,entry},[packed.buffer as ArrayBuffer])}catch(error){finish();reject(new ShamelaPackSeedError('shamela_pack_book_preparation_failed',error))}
 })
}

import {parseVerifiedShamelaPack} from './shamela_pack_prepare'
self.onmessage=event=>{
 try{
  const book=parseVerifiedShamelaPack(event.data.packed,event.data.entry)
  self.postMessage({book},{transfer:[book.data.buffer as ArrayBuffer]})
 }catch(error){self.postMessage({error:error instanceof Error?error.message:'shamela_pack_book_preparation_failed'})}
}

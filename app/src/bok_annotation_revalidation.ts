import type {ReaderAnnotations} from './annotation_store'
import type {StoredBook} from './engine/library_store'
/** Preserve every note/bookmark and highlight quote; never silently move an ambiguous quote. */
export function revalidateBokAnnotations(state:ReaderAnnotations,before:StoredBook,after:StoredBook):ReaderAnnotations{
 if(before.id!==after.id||!before.bokPages||!after.bokPages)throw Error('bok_annotation_source_mismatch')
 if(before.bokPages.length!==after.bokPages.length||before.bokPages.some((page,index)=>page.id!==after.bokPages![index]!.id))throw Error('bok_annotation_page_identity_changed')
 const count=(text:string,quote:string)=>quote?text.split(quote).length-1:0
 return{...state,highlights:state.highlights.map(highlight=>{
  if(highlight.bookId!==before.id)return highlight
  const old=before.bokPages![highlight.pageIndex],next=after.bokPages![highlight.pageIndex]
  if(old&&next&&old.text===next.text)return highlight
  if(old&&next&&count(old.text,highlight.text)===1&&count(next.text,highlight.text)===1){const {sourceReviewRequired:_,...retained}=highlight;return{...retained,occurrence:0}}
  return{...highlight,sourceReviewRequired:true}
 })}
}

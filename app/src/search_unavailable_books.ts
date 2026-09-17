import {canonicalShamelaBookId,shamelaPublicBookId} from './shamela_public_identity'
/** Use only the current search's book snapshot; never fetch another account or
 * display opaque storage identifiers to diagnose incomplete coverage. */
export function unavailableBookDetails(ids:readonly string[]|undefined,books:readonly {id:string;title:string}[]):{shown:string[];remainder:number}{
 const unique=[...new Set(ids??[])],lookup=new Map(books.map(book=>[book.id,book.title]))
 const names=unique.map(id=>{
  const known=lookup.get(id)??lookup.get(canonicalShamelaBookId(id))
  if(known!==undefined)return known.trim()
  // Legacy fallback responses contain SOURCE IDs, not public library IDs.
  // Resolve only against a book actually in the current identity's catalogue.
  if(/^[1-9]\d*$/.test(id)&&Number.isSafeInteger(Number(id))){try{return lookup.get(shamelaPublicBookId(id))?.trim()}catch{return undefined}}
  return undefined
 }).filter((title):title is string=>!!title)
 const shown=names.slice(0,5).map(title=>`«${title.length>200?title.slice(0,200)+'…':title}»`)
 const remainder=unique.length-shown.length
 return {shown,remainder}
}
export function unavailableBooksDescription(ids:readonly string[]|undefined,books:readonly {id:string;title:string}[]):string{
 const {shown,remainder}=unavailableBookDetails(ids,books)
 const details=shown.length?`تعذّر البحث في: ${shown.join('، ')}${remainder?'، وكتب أخرى لم تُعرض أسماؤها':''}.`:'لم تتوفر أسماء الكتب المتعذر بحثها في هذه الصفحة.'
 return `${details} النتيجة غير شاملة؛ لا يمكن الجزم بعدم وجود العبارة. راجع حالة فهرسة هذه الكتب في مكتبتك وأعد المحاولة.`
}

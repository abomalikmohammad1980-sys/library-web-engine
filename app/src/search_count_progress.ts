/** Counts use one declared unit throughout a query. A candidate passage is not
 * an upper bound for occurrences, so candidateCount is never returned as total. */
export interface SearchCountInput {
  matchedCount:number
  /** Cumulative matches already delivered to the consumer in the same unit. */
  deliveredCount?:number
  scannedCandidates:number
  candidateCount:number
  indexedBooks:number
  coverageComplete:boolean
  unit:'passages'|'occurrences'
}
export interface SearchCountProgress {
  total:number
  totalExact:boolean
  hasMore:boolean
  scanComplete:boolean
  coverageComplete:boolean
  indexedBooks:number
  unit:'passages'|'occurrences'
}
export function searchCountProgress(input:SearchCountInput):SearchCountProgress{
  const delivered=input.deliveredCount??input.matchedCount
  const counts=[input.matchedCount,delivered,input.scannedCandidates,input.candidateCount,input.indexedBooks]
  if(counts.some(value=>!Number.isSafeInteger(value)||value<0)||input.scannedCandidates>input.candidateCount
    ||delivered>input.matchedCount||(input.unit==='passages'&&input.matchedCount>input.scannedCandidates))throw new RangeError('invalid_search_count_progress')
  const scanComplete=input.scannedCandidates===input.candidateCount
  return{total:input.matchedCount,totalExact:scanComplete&&input.coverageComplete,hasMore:!scanComplete||delivered<input.matchedCount,scanComplete,coverageComplete:input.coverageComplete,indexedBooks:input.indexedBooks,unit:input.unit}
}
export function searchCountSummary(progress:SearchCountProgress,format:(value:number)=>string=String):string{
  const noun=progress.unit==='passages'?'فقرة مطابقة':'موضعًا مطابقًا'
  if(progress.totalExact)return progress.total===0?'لا توجد نتائج مطابقة.':`${format(progress.total)} ${noun}.`
  const count=progress.total>0?`تأكد وجود ${format(progress.total)} ${noun} حتى الآن. `:''
  if(!progress.coverageComplete)return `${count}تغطية الفهرس غير مكتملة؛ لا يمكن اعتماد عدد نهائي.`
  return `${count}جارٍ التحقق من بقية النتائج؛ العدد النهائي لم يُحسم بعد.`
}

import type { AccountBookSubmission } from './account_service'

const easternDigits=(value:string)=>value.replace(/[0-9]/gu,d=>'٠١٢٣٤٥٦٧٨٩'.charAt(Number(d)))
const arabicNumber=(value:number,maximumFractionDigits=0)=>easternDigits(new Intl.NumberFormat('ar',{maximumFractionDigits}).format(value))

export function accountSubmissionFormat(mimeType:string):string{
  const mime=mimeType.toLocaleLowerCase('en')
  if(mime.includes('pdf'))return'PDF'
  if(mime.includes('epub'))return'EPUB'
  if(mime.includes('shamela')||mime.includes('bok'))return'BOK'
  if(mime.includes('word')||mime.includes('officedocument')||mime.includes('rtf'))return'Word'
  if(mime.startsWith('text/'))return'نص'
  return'ملف كتاب'
}

export function accountSubmissionSize(byteLength:number):string{
  if(byteLength<1024)return`${arabicNumber(byteLength)} بايت`
  if(byteLength<1024*1024)return`${arabicNumber(byteLength/1024,1)} ك.ب`
  return`${arabicNumber(byteLength/(1024*1024),1)} م.ب`
}

export function accountSubmissionDate(createdAt:string):string{
  return easternDigits(new Intl.DateTimeFormat('ar',{dateStyle:'medium',timeStyle:'short'}).format(new Date(createdAt)))
}

export function accountSubmissionFacts(book:Pick<AccountBookSubmission,'category'|'mimeType'|'byteLength'|'createdAt'>):ReadonlyArray<{label:string;value:string}>{
  return [
    ...(book.category?.trim()?[{label:'التصنيف',value:book.category.trim()}]:[]),
    {label:'الصيغة',value:accountSubmissionFormat(book.mimeType)},
    {label:'الحجم',value:accountSubmissionSize(book.byteLength)},
    {label:'تاريخ الرفع',value:accountSubmissionDate(book.createdAt)},
  ]
}

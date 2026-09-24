import {captureReadingIdentity} from './reading_identity_scope'
import {shamelaSourceBookId} from './shamela_public_identity'
import type {StoredBook} from './engine/library_store'

export interface PreviewBookPage {text:string;partLabel:string;pageLabel:string;index:number;total:number}
export function previewBookPage(book:StoredBook,index:number):PreviewBookPage|undefined{
 if(!Number.isSafeInteger(index)||index<0)return undefined
 const page=book.bokPages?.[index]
 return page?{text:page.text,partLabel:String(page.part),pageLabel:String(page.page),index,total:book.bokPages!.length}:undefined
}
/** Use the same public visibility gate as the reader; never infer access from a search hit. */
export async function loadPreviewBook(id:string):Promise<StoredBook>{
 const identity=captureReadingIdentity()
 if(id.startsWith('account-book:')||id.startsWith('central-submission:'))throw Error('معاينة صفحات هذا المصدر غير متاحة بعد؛ افتح الموضع في المكتبة.')
 const book=shamelaSourceBookId(id)
  ? await (await import('./published_library_seed')).ensurePublishedWorkSeeded(id)
  : await (await import('./engine/library_store')).getBook(id)
 if(!identity.isCurrent())throw Error('تغير الحساب؛ أعد فتح المعاينة.')
 if(!book?.bokPages?.length)throw Error('هذا المصدر لا يوفر صفحات نصية للمعاينة؛ افتح الموضع في المكتبة.')
 return book
}

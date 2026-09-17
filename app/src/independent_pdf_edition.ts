import {currentLibraryIdentityScope,savePdfBook,type StoredBook} from './engine/library_store'
import {validateDirectPdf,MAX_DIRECT_PDF_BYTES} from './pdf_import'

export async function addIndependentPdfEdition(book:StoredBook,file:File,edition:string,publisher:string):Promise<string>{
 const scope=currentLibraryIdentityScope()
 if(!edition.trim())throw Error('اكتب اسم الطبعة لتمييزها عن النسخة الحالية.')
 if(file.size>MAX_DIRECT_PDF_BYTES)throw Error('حجم PDF يتجاوز 200 ميجابايت')
 const data=new Uint8Array(await file.arrayBuffer());validateDirectPdf(data,file.name)
 if(currentLibraryIdentityScope()!==scope)throw Error('تغيّر الحساب؛ أعد فتح محرر الكتاب.')
 // Do not inherit a text page map, conversion engine or original edition metadata.
 return savePdfBook({title:book.title,author:book.author,...(book.authorId?{authorId:book.authorId}:{}),...(book.deathYearHijri?{deathYearHijri:book.deathYearHijri}:{}),...(book.contemporary===undefined?{}:{contemporary:book.contemporary}),...(book.category?{category:book.category}:{}),edition:edition.trim(),publisher:publisher.trim(),fileName:file.name,data,relatedWorkId:book.relatedWorkId||book.id},{expectedOwnerScope:scope})
}

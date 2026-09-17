import {currentAccountClaims} from './account_authority'
import {submitAccountBook} from './account_service'
import {centralBookUploadWithWordBundle} from './central_book_upload'
import type {StoredBook} from './engine/library_store'
import {legacyHashToPath} from './path_location'

export interface CloudEdition {id:string;title:string;edition?:string;publisher?:string;public:boolean;packaged?:boolean}
export interface CloudEditions {parent?:CloudEdition;editions:CloudEdition[];hasMore:boolean;page:number}
const mappingKey=(id:string)=>`alkhizana:edition-cloud:${currentAccountClaims()?.subject??'guest'}:${id}`
export function editionCloudId(book:StoredBook):string|undefined{
 const remote=/^(?:central-submission|account-book):([A-Za-z0-9_-]{1,200})$/.exec(book.id)
 if(remote)return remote[1]
 if(book.managedSource==='published'&&/^[A-Za-z0-9_-]{1,200}$/.test(book.id))return book.id
 try{return localStorage.getItem(mappingKey(book.id))??undefined}catch{return undefined}
}
function sessionGuard(){const identity=currentAccountClaims();return()=>{const active=currentAccountClaims();if(!identity||active?.subject!==identity.subject||active.sessionId!==identity.sessionId)throw Error('تغيّر الحساب؛ أعد فتح الكتاب.')}}
export async function syncIndependentPdfEdition(parent:StoredBook,child:StoredBook):Promise<void>{
 const check=sessionGuard();check()
 const upload=async(book:StoredBook,isParent=false)=>{
  const known=editionCloudId(book);if(known)return known
  const input=await centralBookUploadWithWordBundle({localBookId:book.id,book,metadata:book,files:[]});check()
  // An existing mirrored parent may predate rich metadata. Its identity is enough;
  // do not overwrite reviewed metadata while adding an independent edition.
  const payload=isParent&&!input.wordBundle?{file:input.file,title:input.title,author:input.author,...(input.category?{category:input.category}:{})}:input
  const saved=await submitAccountBook(payload);check()
  try{localStorage.setItem(mappingKey(book.id),saved.id)}catch{/* The server upload is idempotent; a retry can recover the receipt. */}
  return saved.id
 }
 const parentId=await upload(parent,true);check();const bookId=await upload(child);check()
 const response=await fetch('/api/library/book-editions',{method:'POST',credentials:'same-origin',redirect:'error',headers:{'content-type':'application/json','x-alkhizana-request':'account-ui'},body:JSON.stringify({bookId,parentId})});check()
 if(!response.ok)throw Error('حُفظت الملفات في الحساب، لكن تعذّر ربط الطبعة. أعد المحاولة لإكمال الربط.')
 const value=await response.json();check()
 if(value.bookId!==bookId||value.linked!==true)throw Error('تعذّر التحقق من حفظ علاقة الطبعة.')
}
/** Existing cloud PDFs keep their own identity, review state and source bytes. */
export async function linkExistingCloudPdf(parent:StoredBook,bookId:string):Promise<void>{
 const check=sessionGuard();check()
 if(!/^[A-Za-z0-9_-]{1,200}$/.test(bookId))throw Error('invalid_edition_id')
 let parentId=editionCloudId(parent)
 if(!parentId){
  const input=await centralBookUploadWithWordBundle({localBookId:parent.id,book:parent,metadata:parent,files:[]});check()
  const payload=input.wordBundle?input:{file:input.file,title:input.title,author:input.author,...(input.category?{category:input.category}:{})}
  const saved=await submitAccountBook(payload);check();parentId=saved.id
  try{localStorage.setItem(mappingKey(parent.id),parentId)}catch{/* Can recover receipt by idempotent upload. */}
 }
 const response=await fetch('/api/library/book-editions',{method:'POST',credentials:'same-origin',redirect:'error',headers:{'content-type':'application/json','x-alkhizana-request':'account-ui'},body:JSON.stringify({bookId,parentId})});check()
 if(!response.ok)throw Error(response.status===403?'ربط طبعة منشورة يتطلب صلاحية تحرير المكتبة.':'تعذّر ربط الطبعة؛ تأكد من ملكيتها وعدم ربطها بأصل آخر.')
 const value=await response.json();check();if(value.bookId!==bookId||value.linked!==true)throw Error('تعذّر التحقق من حفظ علاقة الطبعة.')
}
export async function loadCloudEditions(book:StoredBook,page=0):Promise<CloudEditions|undefined>{
 const id=editionCloudId(book);if(!id)return undefined
 const identity=currentAccountClaims(),response=await fetch(`/api/library/book-editions?id=${encodeURIComponent(id)}&page=${page}`,{credentials:'same-origin',cache:'no-store',redirect:'error'})
 const active=currentAccountClaims();if(active?.subject!==identity?.subject||active?.sessionId!==identity?.sessionId)throw Error('account_session_changed')
 if(!response.ok)throw Error('تعذّر تحميل الطبعات السحابية.')
 const value=await response.json() as CloudEditions
 const after=currentAccountClaims();if(after?.subject!==identity?.subject||after?.sessionId!==identity?.sessionId)throw Error('account_session_changed')
 const valid=(entry:CloudEdition)=>entry&&typeof entry.id==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(entry.id)&&typeof entry.title==='string'&&typeof entry.public==='boolean'
 if(!Array.isArray(value.editions)||value.editions.length>50||value.editions.some(entry=>!valid(entry))||value.parent&&!valid(value.parent)||value.page!==page||typeof value.hasMore!=='boolean')throw Error('invalid_editions_response')
 return value
}
export function cloudEditionHref(edition:CloudEdition):string{
 if(edition.packaged)return legacyHashToPath('#/reader/'+edition.id)
 if(/^\d{1,9}$/.test(edition.id))return `/books/${Number(edition.id)>410000000?Number(edition.id)-410000000:edition.id}`
 return edition.public?`/books/public/${edition.id}`:`/books/local/${encodeURIComponent('account-book:'+edition.id)}`
}

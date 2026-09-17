import {currentAccountClaims} from './account_authority'
export interface PublicQuote {id:string;text:string;bookId:string;bookTitle:string;pageIndex:number;displayName:string;createdAt:string}
export const publicQuoteHref=(quote:Pick<PublicQuote,'bookId'|'pageIndex'>)=>`#/reader/${encodeURIComponent(quote.bookId)}?pageIndex=${quote.pageIndex}`
export async function loadPublicQuotes(page=0,limit=20,mine=false):Promise<{quotes:PublicQuote[];page:number;hasMore:boolean}>{
 if(!Number.isSafeInteger(page)||page<0||!Number.isSafeInteger(limit)||limit<1||limit>50)throw Error('صفحة اقتباسات غير صالحة.')
 const response=await fetch(`/api/${mine?'account':'library'}/quotes?page=${page}&limit=${limit}`,{credentials:mine?'same-origin':'omit',cache:'no-store',signal:AbortSignal.timeout(10000)})
 if(!response.ok)throw Error('تعذّر تحميل الاقتباسات العامة الآن.')
 const value=await response.json()
 if(value?.page!==page||typeof value.hasMore!=='boolean'||!Array.isArray(value.quotes)||value.quotes.length>limit)throw Error('تعذّر التحقق من قائمة الاقتباسات.')
 for(const q of value.quotes)if(!q||typeof q.id!=='string'||typeof q.text!=='string'||q.text.length>2000||typeof q.bookId!=='string'||!q.bookId||typeof q.bookTitle!=='string'||typeof q.displayName!=='string'||!Number.isSafeInteger(q.pageIndex)||q.pageIndex<0||typeof q.createdAt!=='string')throw Error('تعذّر التحقق من الاقتباس.')
 return value
}
export async function withdrawPublicQuote(id:string):Promise<void>{
 const actor=currentAccountClaims();if(!actor)throw Error('سجّل الدخول لإلغاء مشاركة اقتباسك.')
 const response=await fetch(`/api/account/quotes?id=${encodeURIComponent(id)}`,{method:'DELETE',credentials:'same-origin',headers:{'x-alkhizana-request':'account-ui'},signal:AbortSignal.timeout(10000)})
 if(!response.ok)throw Error('تعذّر تأكيد إلغاء المشاركة؛ حدّث القائمة للتحقق.')
 const active=currentAccountClaims();if(active?.subject!==actor.subject||active.sessionId!==actor.sessionId)throw Error('تغيّر الحساب.')
}
export async function publishPublicQuote(input:{text:string;bookId:string;pageIndex:number;sharePublic:true}):Promise<{id:string}>{
 const identity=currentAccountClaims()
 if(!identity)throw Error('سجّل الدخول لمشاركة الاقتباس مع الجميع.')
 if(input.sharePublic!==true||!input.text.trim()||input.text.trim().length>2000||!input.bookId||!Number.isSafeInteger(input.pageIndex)||input.pageIndex<0)throw Error('تحقق من نص الاقتباس وموضعه والموافقة على مشاركته.')
 let sourceBatchId:string|undefined
 if(/^410\d{6}$/.test(input.bookId)){const {loadShamelaAuthorIndex}=await import('./shamela_author_index');const index=await loadShamelaAuthorIndex();sourceBatchId=index.authors.flatMap(author=>author.books).find(book=>book.id===input.bookId)?.batchId}
 const before=currentAccountClaims();if(before?.subject!==identity.subject||before.sessionId!==identity.sessionId)throw Error('تغيّر الحساب؛ أعد فتح الاقتباسات.')
 const response=await fetch('/api/account/quotes',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json','x-alkhizana-request':'account-ui'},body:JSON.stringify({...input,...(sourceBatchId?{sourceBatchId}:{})}),signal:AbortSignal.timeout(15000)})
 const active=currentAccountClaims();if(active?.subject!==identity.subject||active.sessionId!==identity.sessionId)throw Error('تغيّر الحساب؛ أعد فتح الاقتباسات.')
 if(!response.ok)throw Error(response.status===400||response.status===422||response.status===404?'المشاركة العامة متاحة لكتاب منشور للجميع وموضع صالح فيه فقط.':'لم نتأكد من نشر الاقتباس؛ تحقق من صفحة الاقتباسات قبل إعادة المحاولة.')
 const value=await response.json();if(typeof value?.id!=='string'||!value.id)throw Error('تعذّر تأكيد نشر الاقتباس.')
 return {id:value.id}
}

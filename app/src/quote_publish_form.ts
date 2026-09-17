import {h} from './ui'
import {addReaderQuote} from './quote_store'
import {publishPublicQuote} from './public_quotes'
import {currentAccountClaims} from './account_authority'
import {captureReadingIdentity} from './reading_identity_scope'
import {captureRouteResourceScope} from './resource_lifecycle'
interface QuoteInput{text:string;bookId:string;pageIndex?:number}
export async function saveQuoteSelection(input:QuoteInput&{sharePublic:boolean},identity=captureReadingIdentity()):Promise<void>{
 if(!identity.isCurrent())throw Error('تغيّر الحساب؛ أعد فتح الاقتباس.')
 if(input.text.trim().length<5||input.text.trim().length>2000||!input.bookId)throw Error('اكتب اقتباسًا من 5 إلى 2000 حرف.')
 if(input.sharePublic&&(!currentAccountClaims()||!Number.isSafeInteger(input.pageIndex)||input.pageIndex!<0))throw Error('للمشاركة العامة سجّل الدخول واختر اقتباسًا من موضعه في القارئ.')
 addReaderQuote(input.text,input.bookId,identity,input.pageIndex)
 if(input.sharePublic)await publishPublicQuote({text:input.text,bookId:input.bookId,pageIndex:input.pageIndex!,sharePublic:true})
}
export function quotePublishForm(options:QuoteInput&{onSaved?:()=>void}):HTMLFormElement{
 const identity=captureReadingIdentity(),account=currentAccountClaims(),scope=captureRouteResourceScope()
 const form=h('form',{class:'annotation-form','aria-label':'حفظ اقتباس'}) as HTMLFormElement
 const text=h('textarea',{class:'annotation-form__input','aria-label':'نص الاقتباس',value:options.text,maxlength:2000}) as HTMLTextAreaElement
 const share=h('input',{type:'checkbox'}) as HTMLInputElement
 share.checked=false
 const knownPage=Number.isSafeInteger(options.pageIndex)&&options.pageIndex!>=0
 share.disabled=!account||!knownPage
 const status=h('p',{role:'status'}),save=h('button',{type:'submit',class:'btn btn--primary'},'حفظ الاقتباس') as HTMLButtonElement
 form.append(text,h('label',null,share,'مشاركة الاقتباس مع الجميع'),h('p',null,'يبقى الاقتباس خاصًا ما لم تختر مشاركته. المشاركة العامة تظهر باسم حسابك.'))
 if(!account)form.append(h('a',{href:'#/account/sign-in'},'تسجيل الدخول للمشاركة العامة'))
 else if(!knownPage)form.append(h('p',null,'للمشاركة مع الجميع، حدّد الاقتباس من موضعه في القارئ.'))
 form.append(status,save)
 let busy=false,submitted=false
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||submitted||scope.disposed)return
  const active=currentAccountClaims()
  if(!identity.isCurrent()||active?.sessionId!==account?.sessionId){status.textContent='تغيّر الحساب؛ أعد فتح الاقتباس.';save.disabled=true;return}
  busy=true;save.disabled=true;share.disabled=true
  try{await saveQuoteSelection({...options,text:text.value,sharePublic:share.checked},identity);submitted=true;if(!scope.disposed&&identity.isCurrent()){status.textContent=share.checked?'حُفظ الاقتباس وشاركتَه مع الجميع.':'حُفظ الاقتباس الخاص.';options.onSaved?.()}}
  catch(error){if(!scope.disposed&&identity.isCurrent())status.textContent=error instanceof Error?error.message:'تعذّر الحفظ.';if(share.checked){submitted=true;status.append(' لا تُعد الإرسال قبل التحقق من الاقتباسات العامة؛ نسختك الخاصة محفوظة إن تم الحفظ المحلي.')}}
  finally{busy=false;save.disabled=submitted;share.disabled=submitted||!account||!knownPage}
 }
 return form
}
export function openQuotePublishDialog(options:QuoteInput):void{
 const scope=captureRouteResourceScope(),dialog=document.createElement('dialog')
 dialog.className='central-author-dialog';dialog.setAttribute('aria-label','حفظ اقتباس')
 const close=h('button',{type:'button',class:'btn btn--secondary'},'إغلاق')
 close.onclick=()=>dialog.close()
 dialog.append(quotePublishForm(options),close);dialog.onclose=()=>dialog.remove();document.body.append(dialog);scope.add(()=>dialog.remove());dialog.showModal()
}

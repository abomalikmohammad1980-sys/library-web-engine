import {h,toast} from './ui'
import {icon} from './icons'
import {currentAccountClaims,hasAccountPermission} from './account_authority'
import {decideBookSubmission,accountErrorArabic,type AccountBookSubmission} from './account_service'

/** Reuse the existing reviewed cloud copy; never upload a duplicate or infer authority. */
export function privateBookPublishButton(book:AccountBookSubmission,onPublished:()=>void):HTMLButtonElement|undefined{
 if(book.visibility==='public'||!hasAccountPermission(currentAccountClaims(),'book:review-submissions'))return
 const session=currentAccountClaims()?.sessionId
 const current=()=>currentAccountClaims()?.sessionId===session&&hasAccountPermission(currentAccountClaims(),'book:review-submissions')
 const label='نشر الكتاب للعموم'
 const button=h('button',{type:'button',class:'library-card__icon-action',title:label,'aria-label':label},icon('share',18)) as HTMLButtonElement
 button.onclick=async event=>{
  event.preventDefault();event.stopPropagation()
  if(button.disabled||!current()||!confirm(`نشر «${book.title}» للعموم؟ ستتاح نسخة الحساب لجميع زوار المكتبة.`))return
  button.disabled=true
  try{
   await decideBookSubmission(book.id,'publish','',book.reviewVersion??0)
   if(!current())return
   book.visibility='public';book.reviewStatus='approved';book.reviewVersion=(book.reviewVersion??0)+1
   toast('نُشر الكتاب للعموم');onPublished()
  }catch(error){if(current())toast(accountErrorArabic(error))}
  finally{button.disabled=false}
 }
 return button
}

import {h} from './ui'
import {icon} from './icons'
import {accountErrorArabic,deleteAccountBook,updateAccountBook,type AccountBookSubmission} from './account_service'
import {currentAccountClaims} from './account_authority'
import {privateBookPublishButton} from './private_book_publish'

/** Attach only to the owner's account list; the server rechecks ownership. */
export function accountBookActions(book:AccountBookSubmission,onChanged:(change:Pick<AccountBookSubmission,'title'|'author'|'category'|'reviewVersion'|'reviewStatus'>|null)=>void|Promise<void>):HTMLElement[]{
  const session=currentAccountClaims()?.sessionId
  const current=()=>!!session&&currentAccountClaims()?.sessionId===session
  const button=(label:string,name:'edit'|'trash')=>h('button',{type:'button',class:`library-card__icon-action${name==='trash'?' library-card__icon-action--danger':''}`,title:label,'aria-label':label},icon(name,20)) as HTMLButtonElement
  const edit=button('تعديل كتابي','edit'),remove=button('حذف كتابي','trash')
  edit.onclick=e=>{
    e.preventDefault();e.stopPropagation();if(!current())return
    const dialog=h('dialog',{class:'library-book-editor','aria-label':'تعديل كتابي'}) as HTMLDialogElement
    const form=h('form',{class:'library-admin__editor'}) as HTMLFormElement
    const field=(label:string,value:string,max:number)=>{const input=h('input',{value,'aria-label':label,maxlength:max}) as HTMLInputElement;input.required=true;return input}
    const title=field('عنوان الكتاب',book.title,300),author=field('المؤلف',book.author,200),category=field('التصنيف',book.category||'غير مصنف',200)
    const status=h('p',{role:'status'}),save=h('button',{type:'submit',class:'btn btn--primary'},'حفظ') as HTMLButtonElement
    form.append(h('h2',null,'تعديل كتابي'),h('label',null,'عنوان الكتاب',title),h('label',null,'المؤلف',author),h('label',null,'التصنيف',category),status,save,h('button',{type:'button',class:'btn',onclick:()=>dialog.close()},'إلغاء'))
    form.onsubmit=async e=>{e.preventDefault();if(save.disabled)return;if(!current()){dialog.close();return}save.disabled=true
      try{const changes={title:title.value.trim(),author:author.value.trim(),category:category.value.trim(),reviewVersion:book.reviewVersion??0};await updateAccountBook(book.id,changes);if(current()){await onChanged({...changes,reviewVersion:changes.reviewVersion+1,reviewStatus:'pending'});dialog.close()}}
      catch(error){status.textContent=accountErrorArabic(error)}finally{save.disabled=false}}
    const accountChanged=()=>{if(!current())dialog.close()}
    window.addEventListener('alkhizana:account-changed',accountChanged)
    dialog.append(form);dialog.addEventListener('close',()=>{window.removeEventListener('alkhizana:account-changed',accountChanged);dialog.remove()},{once:true});document.body.append(dialog);dialog.showModal()
  }
  remove.onclick=async e=>{e.preventDefault();e.stopPropagation();if(!current()||remove.disabled||!confirm(`حذف «${book.title}» وملفاته من حسابك؟ لا يمكن التراجع عن الحذف.`))return
    remove.disabled=true
    try{await deleteAccountBook(book.id);if(current())await onChanged(null)}catch(error){if(current())alert(accountErrorArabic(error))}finally{remove.disabled=false}}
  const publish=privateBookPublishButton(book,()=>{void onChanged({title:book.title,author:book.author,...(book.category===undefined?{}:{category:book.category}),...(book.reviewVersion===undefined?{}:{reviewVersion:book.reviewVersion}),reviewStatus:book.reviewStatus})})
  return [edit,remove,...(publish?[publish]:[])]
}

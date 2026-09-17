import {h} from './ui'
import {captureAnnotationStores} from './annotation_identity_store'
export function openHighlightComment(id:string):void{
 const editor=captureAnnotationStores(),controller=new AbortController(),input=h('textarea',{'aria-label':'تعليق شخصي اختياري',placeholder:'اكتب تعليقك الشخصي إن رغبت…',maxlength:2000}) as HTMLTextAreaElement
 input.rows=3
 const status=h('p',{role:'status'}),dialog=h('dialog',{class:'reader-error-report__dialog highlight-comment-dialog','aria-label':'تعليق شخصي على التظليل'},h('h3',null,'حُفظ التظليل'),h('p',null,'يمكنك إضافة تعليق شخصي مرتبط بهذا النص. لن يُرسل إلى الإدارة.'),input,status) as HTMLDialogElement
 const close=()=>{controller.abort();dialog.close();dialog.remove()}
 dialog.append(h('div',{class:'reader-error-report__dialog-actions'},h('button',{type:'button',class:'btn',onclick:()=>{if(!editor.isCurrent()){close();return}try{editor.setHighlightComment(id,input.value);close()}catch{status.textContent='تعذّر حفظ التعليق؛ بقي التظليل محفوظًا.'}}},'حفظ التعليق'),h('button',{type:'button',class:'btn btn--secondary',onclick:close},'اكتفاء بالتظليل')))
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()});window.addEventListener('popstate',close,{signal:controller.signal});window.addEventListener('alkhizana:account-changed',close,{signal:controller.signal})
 document.body.append(dialog);dialog.showModal();input.focus()
}

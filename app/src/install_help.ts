import {h} from './ui'
import {detectInstallPlatform,installGuidance} from './install'
/** No installation request or success claim: a visible, dismissible manual path. */
export function showInstallHelp():void {
 const dialog=h('dialog',{'aria-label':'طريقة تثبيت التطبيق',class:'install-help'},h('h2',null,'طريقة تثبيت التطبيق'),h('p',null,installGuidance(detectInstallPlatform(navigator.userAgent)))) as HTMLDialogElement
 const close=h('button',{type:'button',class:'btn'},'إغلاق')
 close.addEventListener('click',()=>dialog.close())
 dialog.append(close);dialog.addEventListener('close',()=>dialog.remove(),{once:true})
 document.body.append(dialog);dialog.showModal()
}

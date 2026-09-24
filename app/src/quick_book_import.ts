import {h} from './ui'
import {icon} from './icons'
import {ensureWordUploadSetup} from './word_upload_setup'
import {getRuntimeCapabilities} from './runtime_capabilities'
import {captureRouteResourceScope} from './resource_lifecycle'
/** Paint the dialog and connect Word before loading document parsers. */
export function openQuickBookImport(files:File[],returnFocus:HTMLElement):void{
 const controller=new AbortController()
 const dialog=h('dialog',{class:'quick-book-import','aria-label':'أضف كتبًا إلى الخزانة'}) as HTMLDialogElement
 const close=h('button',{type:'button',class:'btn btn--secondary',title:'إغلاق','aria-label':'إغلاق'},icon('close',18))
 const workspace=h('div',{'aria-live':'polite'},h('p',null,'جارٍ فتح أدوات الإضافة…'))
 dialog.dataset.importPreparing='';
 dialog.append(h('header',{class:'quick-book-import__head'},h('h2',null,'أضف كتبًا إلى الخزانة'),close),workspace)
 close.addEventListener('click',()=>dialog.close())
 dialog.addEventListener('close',()=>{controller.abort();dialog.remove();window.dispatchEvent(new Event('alkhizana:import-activity'));if(returnFocus.isConnected)returnFocus.focus()},{once:true})
 captureRouteResourceScope().add(()=>{controller.abort();if(dialog.open)dialog.close();dialog.remove()})
 document.body.append(dialog);dialog.showModal();window.dispatchEvent(new Event('alkhizana:import-activity'))
 const load=async()=>{
  try{
   if(files.some(file=>/\.(docx|doc|rtf)$/i.test(file.name))){
    const capabilities=await getRuntimeCapabilities()
    if(controller.signal.aborted)return
    if(!capabilities.wordPdfConversionAvailable&&!await ensureWordUploadSetup(workspace,controller.signal)){if(dialog.open)dialog.close();return}
   }
   if(controller.signal.aborted)return
   delete dialog.dataset.importPreparing;window.dispatchEvent(new Event('alkhizana:import-activity'))
   const {bookImportManager}=await import('./book_import')
   if(controller.signal.aborted)return
   workspace.replaceChildren(bookImportManager(()=>window.dispatchEvent(new Event('library-changed')),{hideLauncher:true,initialFiles:files,signal:controller.signal}))
  }catch{
   if(controller.signal.aborted)return
   delete dialog.dataset.importPreparing;window.dispatchEvent(new Event('alkhizana:import-activity'))
   workspace.replaceChildren(h('p',null,'تعذّر تحميل أدوات الإضافة.'),h('button',{type:'button',class:'btn btn--secondary',onclick:()=>void load()},'إعادة المحاولة'))
  }
 }
 requestAnimationFrame(()=>{if(!controller.signal.aborted)void load()})
}

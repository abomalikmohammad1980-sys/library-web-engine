import {h} from './ui'
import {icon} from './icons'
import {currentAccountClaims} from './account_authority'
import {captureRouteResourceScope,routeEventListener} from './resource_lifecycle'
import {validateDownloadAttachment,MAX_DOWNLOAD_ATTACHMENT_BYTES} from './download_attachment'
import {SUBJECT_CATEGORY_NAMES as BOOK_CATEGORIES} from './subject_categories'
type Target={category?:string;authorKey?:string}
export const attachmentAuthorKey=(value:string)=>/^\d{1,6}$/.test(value)?'shamela-author-'+value:/^(shamela-author-|shamela:|central-author:|local:)/.test(value)?value:'local:'+value
type Attachment={id:string;title:string;description:string;fileName:string;format:'zip'|'rar';byteLength:number;state:'pending'|'public'|'withdrawn';revision:number}
const labelError=(error:unknown)=>error instanceof Error&&error.message==='account_storage_quota_exceeded'?'بلغت حصة التخزين المسموحة لحسابك.':error instanceof Error&&error.message==='authentication_required'?'يلزم تسجيل الدخول لإضافة الأرشيف.':'تعذّر إكمال العملية. لم يُعلن نجاحها؛ أعد المحاولة.'
async function request(url:string,signal:AbortSignal,init:RequestInit={}):Promise<any>{
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',redirect:'error',...init,signal:AbortSignal.any([signal,AbortSignal.timeout(120000)])})
 if(!response.body)throw Error('attachments_unavailable')
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024*1024)throw Error('attachment_response_invalid');chunks.push(value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
 if(!response.ok)throw Error(typeof result.error==='string'?result.error:'attachments_unavailable')
 return result
}
export function openDownloadAttachmentUpload(target:Target={},selected?:File,onSaved:()=>void=()=>{}):void{
 const claims=currentAccountClaims()
 const scope=captureRouteResourceScope(),controller=new AbortController()
 const dialog=h('dialog',{class:'collection-download-dialog','aria-label':'إضافة أرشيف للتحميل'}) as HTMLDialogElement
 const form=h('form',null),status=h('p',{role:'status'}),title=h('input',{'aria-label':'اسم المجموعة',maxlength:300}),description=h('textarea',{'aria-label':'تعريف المجموعة',maxlength:5000})
 const category=h('select',{'aria-label':'التصنيف الموضوعي'},h('option',{value:''},'اختر التصنيف'),...BOOK_CATEGORIES.map(value=>h('option',{value},value)))
 category.value=target.category??'';if(target.category&&!category.value)category.append(h('option',{value:target.category,selected:true},target.category))
 const file=h('input',{type:'file',accept:'.zip,.rar','aria-label':'ملف ZIP أو RAR'})
 let chosen=selected,uploadId='att-'+crypto.randomUUID(),sending=false
 const name=h('p',null,selected?.name??'لم يُحدد ملف'),save=h('button',{type:'submit',class:'btn btn--primary'},'إرسال للمراجعة')
 title.required=true;description.rows=3;title.value=selected?.name.replace(/\.(zip|rar)$/i,'')??''
 file.onchange=()=>{chosen=file.files?.[0];name.textContent=chosen?.name??'لم يُحدد ملف';uploadId='att-'+crypto.randomUUID();if(chosen&&!title.value)title.value=chosen.name.replace(/\.(zip|rar)$/i,'')}
 const stop=()=>{controller.abort();dialog.remove()}
 const current=()=>!scope.disposed&&!controller.signal.aborted&&currentAccountClaims()?.sessionId===claims?.sessionId
 const changed=()=>{if(!current()){dialog.close();stop()}}
 routeEventListener(window,'alkhizana:account-changed',changed,undefined,scope)
 scope.add(stop);dialog.addEventListener('close',stop,{once:true})
 form.append(h('h2',null,'إضافة أرشيف للتحميل'),h('p',null,'ZIP أو RAR حتى 50 ميغابايت. يبقى ملفًا للتحميل فقط دون فك ضغط أو قراءة أو بحث. لا يُتاح للعامة قبل المراجعة.'),h('label',null,'اسم المجموعة',title),h('label',null,'تعريف بها',description),h('label',null,'التصنيف الموضوعي',category),file,name,status,h('div',{style:'display:flex;gap:8px;flex-wrap:wrap'},save,h('button',{type:'button',class:'btn btn--secondary',onclick:()=>dialog.close()},'إلغاء')))
 if(!claims){status.textContent='سجّل الدخول أولًا لإرسال الأرشيف.';save.disabled=true}
 form.onsubmit=async event=>{
  event.preventDefault();if(sending||!current()||!claims)return
  if(!chosen||chosen.size<1||chosen.size>MAX_DOWNLOAD_ATTACHMENT_BYTES){status.textContent='حدد ملفًا غير فارغ لا يتجاوز 50 ميغابايت.';return}
  if(!target.authorKey&&!category.value){status.textContent='اختر تصنيفًا لعرض الأرشيف فيه.';return}
  try{validateDownloadAttachment(chosen.name,new Uint8Array(await chosen.slice(0,8).arrayBuffer()))}catch{status.textContent='امتداد الأرشيف أو توقيعه غير صالح.';return}
  if(!current())return
  sending=true;save.disabled=true;status.textContent='جارٍ رفع الأصل للمراجعة…'
  try{
   const body=new FormData();body.set('file',chosen);body.set('title',title.value.trim());body.set('description',description.value.trim());body.set('category',category.value);body.set('authorKey',target.authorKey??'');body.set('uploadId',uploadId)
   await request('/api/library/attachments',controller.signal,{method:'POST',headers:{'x-alkhizana-request':'account-ui'},body})
   if(current()){status.textContent='حُفظ الأصل وأُرسل للمراجعة، ولم يُنشر للعامة بعد.';save.hidden=true;onSaved()}
  }catch(error){if(current())status.textContent=labelError(error)}finally{sending=false;if(current())save.disabled=false}
 }
 dialog.append(form);document.body.append(dialog);dialog.showModal()
}
export function downloadAttachmentPanel(target:Target,signal?:AbortSignal):HTMLElement{
 const scope=captureRouteResourceScope(),controller=new AbortController();scope.add(()=>controller.abort())
 if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',()=>controller.abort(),{once:true})
 const section=h('section',{class:'download-attachments'}),rows=h('div',null),status=h('p',{role:'status'}),actions=h('div',{style:'display:flex;gap:8px;flex-wrap:wrap'})
 const reveal=h('button',{type:'button',class:'btn btn--secondary'},icon('download',18),'الملفات المجمعة للتحميل')
 let generation=0
 section.append(actions,status,rows)
 const refresh=()=>{
  generation++;rows.replaceChildren();status.textContent='';actions.replaceChildren(reveal)
  const claims=currentAccountClaims()
  if(claims){
   actions.append(h('button',{type:'button',class:'btn btn--secondary',onclick:()=>openDownloadAttachmentUpload(target,undefined,()=>void load('mine'))},'إضافة ZIP / RAR'),h('button',{type:'button',class:'btn btn--secondary',onclick:()=>void load('mine')},'ملفاتي'))
   if(claims.role==='admin'||claims.role==='super-admin')actions.append(h('button',{type:'button',class:'btn btn--secondary',onclick:()=>void load('review')},'مراجعة الأرشيفات'))
  }
 }
 const load=async(mode:'public'|'mine'|'review'='public',after='')=>{
  const version=++generation,session=currentAccountClaims()?.sessionId,current=()=>!scope.disposed&&!controller.signal.aborted&&version===generation&&currentAccountClaims()?.sessionId===session
  const params=new URLSearchParams({...target.category?{category:target.category}:{},...target.authorKey?{author:target.authorKey}:{},...mode==='mine'?{mine:'1'}:mode==='review'?{review:'pending'}:{},...after?{after}:{}})
  status.textContent='جارٍ تحميل قائمة الأرشيفات…';if(!after)rows.replaceChildren()
  try{
   const result=await request('/api/library/attachments?'+params,controller.signal)
   if(!current())return
   if(!Array.isArray(result.attachments)||result.attachments.length>50||result.attachments.some((a:Attachment)=>!/^att-[a-f0-9-]{36}$/.test(a.id)||typeof a.title!=='string'||typeof a.description!=='string'||!['zip','rar'].includes(a.format)||!['public','pending','withdrawn'].includes(a.state)||!Number.isSafeInteger(a.revision)))throw Error('invalid_attachment_response')
   for(const a of result.attachments as Attachment[]){
    const row=h('article',{class:'download-attachment'},h('h3',null,a.title),h('p',{style:'white-space:pre-wrap'},a.description),h('a',{href:'/api/library/attachments/'+a.id,class:'btn btn--secondary',title:'تحميل الأصل',target:'_blank',rel:'noopener'},icon('download',18),a.format.toUpperCase()),h('small',null,`${(a.byteLength/1024/1024).toFixed(1)} ميغابايت · ${a.state==='public'?'منشور':a.state==='pending'?'بانتظار المراجعة':'مسحوب'}`))
    const decision=(state:'public'|'withdrawn',label:string)=>h('button',{type:'button',class:'btn btn--secondary',onclick:async event=>{const button=event.currentTarget as HTMLButtonElement;button.disabled=true;try{await request('/api/library/attachments',controller.signal,{method:'PATCH',headers:{'content-type':'application/json','x-alkhizana-request':'account-ui'},body:JSON.stringify({id:a.id,state,revision:a.revision})});if(current())void load(mode)}catch(error){if(current())status.textContent=labelError(error)}finally{if(current())button.disabled=false}}},label)
    if(mode==='review')row.append(decision('public','إتاحة للعامة'),decision('withdrawn','رفض الإتاحة'))
    if(mode==='mine'&&a.state!=='withdrawn')row.append(decision('withdrawn','سحب الإتاحة'))
    rows.append(row)
   }
   status.textContent=rows.childElementCount?'':'لا توجد أرشيفات في هذه القائمة.'
   if(result.next){if(!/^att-[a-f0-9-]{36}$/.test(result.next))throw Error('invalid_attachment_response');const more=h('button',{type:'button',class:'btn btn--secondary',onclick:()=>{more.remove();void load(mode,result.next)}},'المزيد');status.append(more)}
  }catch(error){if(current())status.textContent=labelError(error)}
 }
 reveal.onclick=()=>void load();window.addEventListener('alkhizana:account-changed',refresh,{signal:controller.signal});refresh();return section
}

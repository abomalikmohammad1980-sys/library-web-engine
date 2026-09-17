import {h} from './ui'
import {currentAccountClaims} from './account_authority'
import {captureRouteResourceScope} from './resource_lifecycle'
import {pageJump} from './page_jump'
export const indexingStatusLabels={queued:'في الانتظار',extracting:'استخراج النص',indexing:'فهرسة',ready:'جاهز',ocr_pending:'مصوّر — بلا نص قابل للبحث',failed:'فشل',removed:'أُزيل'} as const
const labels=indexingStatusLabels
type Status=keyof typeof labels
type Row={bookId:string;title:string;status:Status;contentVersion:number;updatedAt:number;indexedAt:number|null;tocSource:'native'|'pdf_bookmarks'|'none';ocr:boolean}
export function parseIndexingPage(value:any):{rows:Row[];page:number;pages:number;counts:{ready:number;processing:number;failed:number;ocrPending:number}}{
 if(!value||!Number.isSafeInteger(value.page)||value.page<1||!Number.isSafeInteger(value.pages)||value.pages<1||!Array.isArray(value.rows)||value.rows.length>100)throw Error('invalid')
 if(!value.counts||!['ready','processing','failed','ocrPending'].every(k=>Number.isSafeInteger(value.counts[k])&&value.counts[k]>=0))throw Error('invalid')
 for(const row of value.rows)if(!row||typeof row.bookId!=='string'||row.bookId.length>200||typeof row.title!=='string'||row.title.length>1000||!Object.hasOwn(labels,row.status)||!Number.isSafeInteger(row.contentVersion)||row.contentVersion<1||!Number.isSafeInteger(row.updatedAt)||!(row.indexedAt===null||Number.isSafeInteger(row.indexedAt))||!['native','pdf_bookmarks','none'].includes(row.tocSource)||typeof row.ocr!=='boolean')throw Error('invalid')
 return value
}
async function responseJson(response:Response){
 if(!response.ok)throw Error('unavailable')
 const reader=response.body?.getReader();if(!reader)throw Error('body')
 const chunks:Uint8Array[]=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>256000)throw Error('large');chunks.push(value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}return JSON.parse(new TextDecoder().decode(bytes))
}
export function adminIndexingPanel():HTMLElement{
 const host=h('section',{class:'library-admin','aria-label':'حالة فهرسة الكتب'}),claims=currentAccountClaims()
 if(!claims||!['super-admin','admin'].includes(claims.role))return host
 const scope=captureRouteResourceScope(),abort=new AbortController();scope.add(()=>abort.abort())
 const active=()=>!scope.disposed&&!abort.signal.aborted&&currentAccountClaims()?.subject===claims.subject&&currentAccountClaims()?.sessionId===claims.sessionId&&['super-admin','admin'].includes(currentAccountClaims()?.role??'')
 const status=h('p',{role:'status'}),body=h('div',null),counts=h('p',null),refresh=h('button',{type:'button',class:'btn btn--secondary'},'تحديث حالة الفهرسة') as HTMLButtonElement
 let page=0,pages=1,busy=false
 const jump=pageJump('حالة الفهرسة',next=>{page=next;void load()})
 const previous=h('button',{type:'button',class:'btn btn--secondary'},'السابق') as HTMLButtonElement,next=h('button',{type:'button',class:'btn btn--secondary'},'التالي') as HTMLButtonElement
 const signal=()=>AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])
 const controls=()=>{refresh.disabled=busy;previous.disabled=busy||page===0;next.disabled=busy||page+1>=pages;jump.update(page,pages,busy)}
 const retry=async(row:Row)=>{if(busy||!active()||row.status!=='failed')return;busy=true;controls();try{await responseJson(await fetch('/api/admin/book-indexing',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',signal:signal(),headers:{'content-type':'application/json','x-alkhizana-request':'account-ui'},body:JSON.stringify({bookId:row.bookId,contentVersion:row.contentVersion})}));if(active())status.textContent='أُضيف الكتاب إلى انتظار إعادة المحاولة.'}catch{if(active())status.textContent='تعذّرت إعادة المحاولة؛ حدّث الحالة وتحقق من صلاحيتك.'}finally{busy=false;if(active())void load()}}
 const date=(n:number|null)=>n===null?'لم تكتمل بعد':new Date(n*1000).toLocaleString('ar')
 async function load(){if(busy||!active())return;busy=true;controls();status.textContent='جارٍ تحميل حالة الفهرسة…'
  try{const data=parseIndexingPage(await responseJson(await fetch('/api/admin/book-indexing?page='+(page+1),{credentials:'same-origin',cache:'no-store',redirect:'error',signal:signal()})));if(!active())return;pages=data.pages;page=data.page-1
   counts.textContent=`جاهز: ${data.counts.ready} · قيد المعالجة: ${data.counts.processing} · فاشل: ${data.counts.failed} · مصوّر بلا نص: ${data.counts.ocrPending}`
   body.replaceChildren(...data.rows.map(row=>{const item=h('div',{class:'admin-published-row'},h('strong',null,row.title||row.bookId),h('p',null,labels[row.status]),h('p',null,`آخر فهرسة: ${date(row.indexedAt)} · آخر تحديث: ${date(row.updatedAt)}`),h('p',null,`مصدر الفهرس: ${{native:'العناوين الأصلية',pdf_bookmarks:'علامات PDF المرجعية',none:'لا يوجد'}[row.tocSource]} · استخراج مصوّر: ${row.ocr?'نعم':'لا'}`));if(row.status==='failed'){const button=h('button',{type:'button',class:'btn btn--secondary'},'إعادة المحاولة');button.onclick=()=>void retry(row);item.append(button)}return item}));status.textContent=data.rows.length?'':'لا توجد كتب في سجل الفهرسة.'
  }catch{if(active()){body.replaceChildren();counts.textContent='';status.textContent='حالة الفهرسة غير متاحة الآن؛ لم نعرض بيانات قديمة.'}}finally{busy=false;if(active())controls()}}
 previous.onclick=()=>{page--;void load()};next.onclick=()=>{page++;void load()};refresh.onclick=()=>void load()
 host.append(h('h2',null,'حالة فهرسة الكتب'),refresh,counts,body,status,h('div',null,previous,jump.element,next))
 const changed=()=>{if(!active()){abort.abort();host.replaceChildren()}else void load()};window.addEventListener('alkhizana:account-changed',changed);scope.add(()=>window.removeEventListener('alkhizana:account-changed',changed))
 void load();return host
}

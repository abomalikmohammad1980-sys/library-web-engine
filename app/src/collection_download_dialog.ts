import {collectionDownloadArchive} from './collection_download_archive'
import {h} from './ui'
import {downloadArtifact} from './artifact_download'
import {archiveEntryName} from './download_attachment'
import {collectionDownloadContent,prepareCollectionBatch,prepareCollectionSingle,COLLECTION_BATCH_BYTES,COLLECTION_SINGLE_BYTES,type CollectionDownloadBatch} from './collection_download_batch'
import {boundCollectionOriginals,planCollectionOriginals,type CollectionOriginalBook} from './collection_originals'
import {captureRouteResourceScope} from './resource_lifecycle'
import type {CollectionDownloadAsset} from './collection_download_batch'

export function openCollectionDownload(options:{
  title:string
  books:readonly {id:string;title:string}[]|((signal:AbortSignal)=>Promise<readonly {id:string;title:string}[]>)
  resolve:(id:string,signal:AbortSignal)=>Promise<CollectionOriginalBook|undefined>
  isCurrent:()=>boolean
  remote?:(id:string,signal:AbortSignal)=>Promise<CollectionDownloadAsset[]>
}):void{
 const scope=captureRouteResourceScope(),controller=new AbortController()
 const dialog=h('dialog',{class:'collection-download-dialog',dir:'rtl','aria-label':'تحميل الملفات الأصلية'}) as HTMLDialogElement
 const status=h('p',{'role':'status','aria-live':'polite'}),details=h('div',null),actions=h('div',{style:'display:flex;gap:8px;flex-wrap:wrap'})
 const start=h('button',{type:'button',class:'btn btn--primary'},'فحص الملفات الأصلية') as HTMLButtonElement
 const save=h('button',{type:'button',class:'btn btn--primary',hidden:true},'حفظ الدفعة') as HTMLButtonElement
 const next=h('button',{type:'button',class:'btn btn--secondary',hidden:true},'تجهيز الدفعة التالية') as HTMLButtonElement
 const close=h('button',{type:'button',class:'btn btn--secondary'},'إغلاق وإيقاف')
 actions.append(start,next,save,close)
 dialog.append(h('h2',null,options.title),h('p',null,'الأصول فقط، بلا نصوص أو ملفات بديلة. حتى 20 ملفًا أو 50 ميغابايت لكل دفعة مضغوطة؛ الأصل الأكبر حتى 64 ميغابايت يُحفظ منفردًا. طلب واحد في كل مرة، واحفظه قبل الانتقال.'),status,details,actions)
 let plan:Awaited<ReturnType<typeof planCollectionOriginals>>|undefined,cursor=0,part=1,ready:({kind:'archive';bytes:Uint8Array;batch:CollectionDownloadBatch}|{kind:'single';bytes:Uint8Array;name:string;nextIndex:number})|undefined
 const current=()=>!controller.signal.aborted&&!scope.disposed&&options.isCurrent()
 const accountChanged=()=>{if(!options.isCurrent()){stop();dialog.close();dialog.remove()}}
 const stop=()=>{controller.abort();ready=undefined;window.removeEventListener('alkhizana:account-changed',accountChanged)}
 window.addEventListener('alkhizana:account-changed',accountChanged)
 close.addEventListener('click',()=>dialog.close())
 dialog.addEventListener('close',()=>{stop();dialog.remove()},{once:true})
 scope.add(()=>{stop();dialog.close();dialog.remove()})
 const failure=()=>{if(current())status.textContent='تعذّر تجهيز الدفعة. لم يتقدم موضع التنزيل؛ يمكنك إعادة المحاولة. قد يكون الأصل غير متاح أو تغيرت نسخته.'}
 const prepare=async()=>{
  if(!plan||!current())return
  next.disabled=true;save.hidden=true;status.textContent='جارٍ تجهيز الدفعة…'
  try{
   const standalone=plan.assets[cursor]
   if(standalone&&standalone.bytes>COLLECTION_BATCH_BYTES){
    const bytes=await prepareCollectionSingle(standalone,controller.signal)
    if(!current())return
    ready={kind:'single',bytes,name:archiveEntryName(standalone.fileName),nextIndex:cursor+1}
    save.hidden=false;next.hidden=true;save.textContent=`حفظ الأصل ${cursor+1}`
    status.textContent=`الأصل جاهز (${(bytes.length/1024/1024).toFixed(1)} ميغابايت). لم يبدأ الحفظ بعد.`
    return
   }
   const batch=await prepareCollectionBatch(plan.assets,cursor,controller.signal,(done,total)=>{if(current())status.textContent=`تجهيز ${done} من ${total}`})
   if(!current())return
   const bytes=await collectionDownloadArchive(batch,{title:options.title,part,totalAvailableFiles:plan.assets.length,unavailable:plan.unavailable,signal:controller.signal})
   if(!current())return
   ready={kind:'archive',bytes,batch};save.hidden=false;next.hidden=true;save.textContent=`حفظ الدفعة ${part} (${batch.entries.length} ملفًا)`
   status.textContent=`الدفعة جاهزة: ${(batch.bytes/1024/1024).toFixed(1)} ميغابايت. لم يبدأ الحفظ بعد.`
  }catch{failure()}finally{if(current())next.disabled=false}
 }
 start.addEventListener('click',async()=>{
  start.disabled=true;status.textContent='جارٍ التحقق من توفر الأصول؛ لا تُستبدل الملفات المفقودة بنصوص مشتقة.'
  try{
   const books=typeof options.books==='function'?await options.books(controller.signal):options.books
   if(!current())return
   plan=boundCollectionOriginals(await planCollectionOriginals(books,options.resolve,controller.signal,current,options.remote),COLLECTION_SINGLE_BYTES)
   if(!current())return
   const missing=h('details',null,h('summary',null,`أصول غير مضمنة: ${plan.unavailable.length}`),h('ul',null,...plan.unavailable.map(ref=>h('li',null,ref.reason==='size_limit'?`${ref.title} — يتجاوز حد 64 ميغابايت؛ نزّله منفردًا من بطاقة الكتاب`:ref.title))))
   details.replaceChildren(h('p',null,`ملفات أصلية متاحة: ${plan.assets.length}. لا تعني هذه الأعداد اكتمال المجموعة إذا وُجدت أصول غير متاحة.`),missing)
   if(!plan.assets.length){status.textContent=plan.unavailable.some(ref=>ref.reason==='size_limit')?'لا توجد أصول ضمن حد تنزيل المجموعة. الأصول الكبيرة مبيّنة أعلاه ويمكن تنزيلها منفردة من بطاقاتها.':'لا توجد ملفات أصلية متاحة للتنزيل في هذه المجموعة حاليًا.';return}
   start.hidden=true;next.hidden=false;next.textContent='تجهيز الدفعة الأولى';status.textContent='جاهز. لا يبدأ تجهيز الملفات إلا عند الضغط.'
  }catch{failure()}finally{if(current())start.disabled=false}
 })
 next.addEventListener('click',()=>void prepare())
 save.addEventListener('click',()=>{
  if(!ready||!plan||!current())return
  const item=ready
  downloadArtifact(item.kind==='single'
   ?{fileName:`${String(cursor+1).padStart(5,'0')}-${item.name}`,mimeType:'application/octet-stream',content:collectionDownloadContent(item.bytes)}
   :{fileName:`${archiveEntryName(options.title)}-${String(part).padStart(3,'0')}.zip`,mimeType:'application/zip',content:collectionDownloadContent(item.bytes)})
  cursor=item.kind==='single'?item.nextIndex:item.batch.nextIndex
  if(item.kind==='archive')part++
  ready=undefined;save.hidden=true
  next.hidden=cursor>=plan.assets.length;next.textContent='تجهيز الدفعة التالية'
  status.textContent=next.hidden?'أُرسلت الدفعات المتاحة للحفظ؛ تحقق من مجلد التنزيلات. لم تُضم الأصول غير المتاحة.':'بدأ حفظ الدفعة. بعد التأكد من تنزيلها يمكنك تجهيز التالية.'
 })
 document.body.append(dialog);dialog.showModal()
}

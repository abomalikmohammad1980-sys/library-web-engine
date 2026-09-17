import {h} from './ui'
import type {StoredBook} from './engine/library_store'
import {centralBookRecordId} from './central_book_action'
import {bokTextHash,findBokText,replaceBokText,type BokTextPage,type BokTextDraft} from './bok_text_model'
import {bokTextDraftRequest,captureBokEditorIdentity} from './bok_text_service'
import {downloadArtifact} from './artifact_download'
import {bokEditorialCapabilities,bokPublicationRequest,bokPublicationStatus} from './bok_publication_service'
import {renderBoundUiTemplate,uiTemplateText,uiTemplateAttribute,uiLabelParameter} from './ui_template_binding'

/** Draft-only workbench: does not mutate the source BOK or published reader/index. */
export function bokTextEditor(book:StoredBook):HTMLElement{
 const root=h('section',{class:'bok-text-editor','aria-label':'محرر نص الكتاب',dir:'rtl'}),identity=captureBokEditorIdentity()
 if(!identity()||book.managedSource!=='published')return root
 const pages=book.bokPages
 if(!pages?.length){root.append(h('p',null,'افتح الكتاب في القارئ أولًا لتنزيل صفحاته، ثم افتح تحرير النص.'));return root}
 if(!/^[a-f0-9]{64}$/.test(book.originalSha256)||new Set(pages.map(p=>p.id)).size!==pages.length||pages.some(p=>!Number.isSafeInteger(p.id)||p.id<0)){root.append(h('p',null,'تعذّر التحقق من هوية النسخة وصفحاتها؛ لن يُفتح التحرير على مصدر ملتبس.'));return root}
 const id=centralBookRecordId(book.id),drafts=new Map<number,BokTextDraft>()
 let index=0,ticket=0,loaded=false,busy=false,baseline='',baseHash=''
 const current=()=>identity()&&root.isConnected
 const message=h('p',{role:'status','aria-live':'polite'})
 const label=h('strong',null),position=h('input',{type:'number',min:'1',max:String(pages.length),value:'1','aria-label':'ترتيب الصفحة داخل الكتاب'})
 const text=h('textarea',{dir:'rtl',dataset:{noTranslate:''},'aria-label':'نص الصفحة القابل للتحرير',maxlength:100000})
 text.spellcheck=false
 const original=h('pre',{dir:'rtl',dataset:{noTranslate:''}})
 const query=h('input',{type:'search',placeholder:'ابحث عن نص في الكتاب','aria-label':'البحث في نص الكتاب',dataset:{noTranslate:''}})
 const replacement=h('input',{placeholder:'النص البديل','aria-label':'النص البديل',dataset:{noTranslate:''}})
 for(const [element,attribute,label] of [[text,'aria-label','نص الصفحة القابل للتحرير'],[query,'aria-label','البحث في نص الكتاب'],[query,'placeholder','ابحث عن نص في الكتاب'],[replacement,'aria-label','النص البديل'],[replacement,'placeholder','النص البديل']] as const)uiTemplateAttribute(element,attribute,'bok-owned-input-label',{p1:uiLabelParameter(label)})
 const button=(name:string,action:()=>void)=>h('button',{class:'btn btn--secondary',type:'button',onclick:action},name)
 const dirty=()=>text.value!==baseline
 const leave=()=>!dirty()||confirm(renderBoundUiTemplate('bok-leave-page-confirm',{},document.documentElement.lang||'ar'))
 const save=button('حفظ مسودة الصفحة',()=>void persist());save.className='btn btn--primary';save.disabled=true
 const reload=button('تحميل المسودة الأحدث',()=>{if(leave())void open(index)})
 const prev=button('السابقة',()=>go(index-1)),next=button('التالية',()=>go(index+1))
 function availability(){root.dataset.bokUnsaved=String(dirty());save.disabled=!loaded||busy||!dirty()||!current();prev.disabled=busy||index===0;next.disabled=busy||index===pages!.length-1;position.disabled=busy;reload.disabled=busy;text.readOnly=busy}
 text.oninput=()=>{availability();message.textContent=dirty()?'تعديلات غير محفوظة.':'لا توجد تعديلات جديدة.'}
 const go=(target:number)=>{if(!current()||busy||!Number.isInteger(target)||target<0||target>=pages!.length||!leave()){position.value=String(index+1);return}void open(target)}
 async function open(target:number){
  const page=pages?.[target];if(!page)return
  const generation=++ticket;index=target;loaded=false;busy=true;baseHash='';baseline=page.text;text.value=baseline;original.textContent=baseline;position.value=String(index+1)
  label.replaceChildren(uiTemplateText('bok-page-position',{p1:page.part,p2:page.page,p3:index+1,p4:pages!.length}))
  availability();message.textContent='جارٍ تحميل مسودة الصفحة…'
  try{
   const [hash,draft]=await Promise.all([bokTextHash(baseline),bokTextDraftRequest(id,book.originalSha256,page.id,current)])
   if(!current()||generation!==ticket)return
   baseHash=hash
   if(draft&&draft.baseHash!==hash)throw Error('تغيّرت النسخة الأصلية لهذه الصفحة؛ لن تُطبّق عليها مسودة نسخة أخرى.')
   if(draft)drafts.set(page.id,draft);else drafts.delete(page.id)
   baseline=draft?.text??page.text;text.value=baseline;loaded=true
   message.replaceChildren(draft?uiTemplateText('bok-loaded-draft',{p1:draft.revision}):'يمكنك تحرير الصفحة وحفظ مسودة. الأصل المنشور لن يتغير.')
  }catch(error){if(current()&&generation===ticket)message.textContent=error instanceof Error?error.message:'تعذّر تحميل المسودة.'}
  finally{if(current()&&generation===ticket){busy=false;availability()}}
 }
 async function persist(){
  if(!current()||!loaded||busy||!dirty())return
  const page=pages?.[index];if(!page)return
  const captured=text.value,pageId=page.id,expectedRevision=drafts.get(pageId)?.revision??0
  busy=true;availability();message.textContent='جارٍ حفظ المسودة…'
  try{const draft=await bokTextDraftRequest(id,book.originalSha256,pageId,current,{baseHash,text:captured,expectedRevision});if(!current())return;if(!draft)throw Error('لم يُؤكد الحفظ.');drafts.set(pageId,draft);baseline=captured;message.replaceChildren(uiTemplateText('bok-saved-draft',{p1:draft.revision}))}
  catch(error){if(current())message.textContent=error instanceof Error?error.message:'تعذّر تأكيد الحفظ؛ النص ما زال هنا.'}
  finally{if(current()){busy=false;availability()}}
 }
 const search=button('بحث / التالي',()=>{
  if(!current()||busy||!query.value)return
  // Search original pages plus drafts already opened in this session; label states this limit.
  const effective:BokTextPage[]=pages.map((p,i)=>({...p,text:i===index?text.value:drafts.get(p.id)?.text??p.text}))
  const offset=text.value.indexOf(query.value,text.selectionEnd)
  if(offset>=0){text.focus();text.setSelectionRange(offset,offset+query.value.length);return}
  const found=findBokText(effective,query.value,index+1)
  if(!found){message.textContent='لم يوجد النص في الأصل والمسودات المفتوحة.';return}
  if(found.index===index){text.focus();text.setSelectionRange(found.offset,found.offset+query.value.length)}else go(found.index)
 })
 const replace=button('استبدال في هذه الصفحة',()=>{
  if(!current()||busy||!query.value)return
  const result=replaceBokText(text.value,query.value,replacement.value)
  if(result.text.length>100000){message.textContent='النص الناتج أطول من الحد المسموح للصفحة.';return}
  if(result.count&&confirm(renderBoundUiTemplate('bok-replace-confirm',{p1:result.count},document.documentElement.lang||'ar'))){text.value=result.text;availability();message.replaceChildren(uiTemplateText('bok-replaced-count',{p1:result.count}))}
 })
 const reset=button('استعادة نص الأصل',()=>{const page=pages[index];if(page&&current()&&!busy&&confirm(renderBoundUiTemplate('bok-reset-confirm',{},document.documentElement.lang||'ar'))){text.value=page.text;availability()}})
 const exportDraft=button('تصدير النص للمراجعة',()=>{const page=pages[index];if(page&&current())downloadArtifact({fileName:`bok-${page.id}-draft.txt`,mimeType:'text/plain;charset=utf-8',content:text.value})})
 const exportRelease=button('تجهيز مرشح النص والبحث',()=>void prepareRelease())
 const submitRelease=button('طلب نشر التصحيحات',()=>void prepareRelease(true));submitRelease.hidden=true
 const refreshJob=button('حالة طلب النشر',()=>void loadJob());refreshJob.hidden=true
 async function loadJob(){try{const job=await bokPublicationRequest(current,id);if(current())message.textContent=job?bokPublicationStatus(job):'لا يوجد طلب نشر مسجّل لهذا الكتاب.'}catch(error){if(current())message.textContent=error instanceof Error?error.message:'تعذّر تحميل حالة الطلب.'}}
 async function prepareRelease(submit=false){
  if(!current()||busy)return
  if(dirty()){message.textContent='احفظ مسودة الصفحة أولًا قبل تجهيز مرشح النشر.';return}
  if(!drafts.size){message.textContent='افتح مسودات الصفحات المراد مراجعتها أولًا.';return}
  if(!confirm(submit?'سيُسجّل طلب نشر للصفحات التي فتحت مسوداتها وراجعتها هنا فقط. لن تُنشر تلقائيًا قبل بناء الإصدار والتحقق منه. هل تتابع؟':'سيُجهّز ملف مراجعة للصفحات التي فتحت مسوداتها هنا فقط، مع فهرس بحث مطابق. هذا لا ينشر التعديلات للعامة. هل تتابع؟'))return
  busy=true;availability();exportRelease.disabled=true;submitRelease.disabled=true
  try{
   // Re-read the server revisions at review time; never export stale cached drafts.
   const reviewed=[]
   for(const [pageId,expected] of drafts){
    const actual=await bokTextDraftRequest(id,book.originalSha256,pageId,current)
    if(!actual||actual.revision!==expected.revision||actual.baseHash!==expected.baseHash||actual.text!==expected.text)throw Error('تغيّرت مسودة أثناء المراجعة؛ حمّل النسخة الأحدث قبل التجهيز.')
    reviewed.push({...actual,pageId,expectedRevision:expected.revision})
   }
   if(submit){const job=await bokPublicationRequest(current,id,{sourceHash:book.originalSha256,reviews:reviewed.map(({pageId,revision,baseHash,text})=>({pageId,revision,baseHash,text}))});if(current()&&job){message.textContent=bokPublicationStatus(job);refreshJob.hidden=false}return}
   const {buildBokTextRelease}=await import('./bok_text_release')
   const release=await buildBokTextRelease(book,book.originalSha256,reviewed)
   if(!current())return
   downloadArtifact({fileName:`bok-${id}-${release.revisionHash.slice(0,12)}-candidate.json`,mimeType:'application/json',content:JSON.stringify(release)})
   message.textContent='جُهّز مرشح المراجعة بالنص والفهرس معًا. لم يتغير الكتاب المنشور؛ يلزم تفعيلهما معًا بعد التحقق.'
  }catch(error){if(current())message.textContent=error instanceof Error?error.message:'تعذّر تجهيز مرشح النشر.'}
  finally{if(current()){busy=false;exportRelease.disabled=false;submitRelease.disabled=false;availability()}}
 }
 position.onchange=()=>go(Number(position.value)-1)
 root.append(h('h3',null,'تحرير نص الكتاب'),h('p',null,'مسودات تصحيح النص. البحث يشمل النص الأصلي والمسودات التي فتحتها هنا. طلب النشر يحتاج بناء الإصدار والتحقق منه قبل أن يظهر للقارئ.'),h('div',{class:'bok-text-editor__tools'},query,search,replacement,replace),h('div',{class:'bok-text-editor__tools'},prev,label,position,next),text,h('details',null,h('summary',null,'مقارنة بالنص الأصلي'),original),h('div',{class:'bok-text-editor__tools'},save,reload,reset,exportDraft,exportRelease,submitRelease,refreshJob),message)
 const abort=new AbortController()
 const clear=()=>{ticket++;drafts.clear();root.replaceChildren(h('p',null,'أُغلق محرر النص لتغيّر الصفحة أو الحساب.'));abort.abort()}
 window.addEventListener('alkhizana:account-changed',clear,{signal:abort.signal})
 window.addEventListener('popstate',clear,{signal:abort.signal})
 window.addEventListener('beforeunload',event=>{if(current()&&dirty()){event.preventDefault();event.returnValue=''}},{signal:abort.signal})
 document.addEventListener('click',event=>{const link=(event.target as Element|null)?.closest?.('a[href]');if(current()&&dirty()&&link&&!root.contains(link)&&!confirm(renderBoundUiTemplate('bok-leave-editor-confirm',{},document.documentElement.lang||'ar'))){event.preventDefault();event.stopImmediatePropagation()}},{capture:true,signal:abort.signal})
 // Mount happens immediately at the caller; no hidden/background fetch before permission checks.
 queueMicrotask(()=>{if(current()){void open(0);void bokEditorialCapabilities(current).then(features=>{if(current()){submitRelease.hidden=!features.submissionEnabled;refreshJob.hidden=!features.submissionEnabled}}).catch(()=>undefined)}})
 return root
}

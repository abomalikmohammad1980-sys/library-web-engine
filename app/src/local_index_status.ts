import{backgroundDataInteractionAllowed}from'./background_data_scheduler';
import{LocalIndexJobs}from'./engine/local_index_jobs';
import{currentLibraryIdentityScope,getBook,readPrivateLibrarySnapshot}from'./engine/library_store';
import{inferBookFormat}from'./book_format';
import{checkpointWordJobs,pendingWordIds,resumeWordCheckpoint,createWordResumeRunner}from'./engine/local_index_resume';
import{captureRouteResourceScope}from'./resource_lifecycle';
import{toast}from'./ui';
export const localBookIndexJobs=new LocalIndexJobs({scope:currentLibraryIdentityScope,run:async(bookId,signal)=>{const {prepareLocalBookSearchIndex}=await import('./engine/search_store');if(signal.aborted)throw new DOMException('Cancelled','AbortError');return prepareLocalBookSearchIndex(bookId,{signal})},completed:job=>toast(`اكتملت فهرسة «${job.title}» وأصبح نصه متاحًا للبحث في مكتبتك.`)});
if(typeof window!=='undefined'){const sync=()=>localBookIndexJobs.setPaused(!backgroundDataInteractionAllowed());window.addEventListener('alkhizana:import-activity',sync);sync()}
if(typeof window!=='undefined')window.addEventListener('alkhizana:account-changed',()=>localBookIndexJobs.identityChanged());
const checkpointStorage=()=>currentLibraryIdentityScope().startsWith('guest:')?sessionStorage:localStorage;
let warnedScope:string|undefined;
function warnCheckpoint(){const scope=currentLibraryIdentityScope();if(warnedScope===scope)return;warnedScope=scope;toast('تعذّر حفظ استئناف الفهرسة تلقائيًا: الحد 4096 كتابًا و1 ميبيبايت، أو أن التخزين غير متاح. لا تغلق الصفحة قبل اكتمال المهام الحالية؛ الكتب نفسها محفوظة.')}
localBookIndexJobs.subscribe(()=>{try{checkpointWordJobs(checkpointStorage(),currentLibraryIdentityScope(),localBookIndexJobs.snapshot())}catch{warnCheckpoint()}});
if(typeof window!=='undefined')window.addEventListener('library-changed',()=>{void resumeImportedWordIndexing()});
export const resumeImportedWordIndexing=createWordResumeRunner({scope:currentLibraryIdentityScope,canRun:backgroundDataInteractionAllowed,run:async(scope)=>{
 try{const storage=checkpointStorage();const known=new Set(pendingWordIds(storage,scope));const metadata=readPrivateLibrarySnapshot().filter(book=>inferBookFormat(book)==='word'&&!/^(?:shamela|published)/.test(book.id));for(const book of metadata)known.add(book.id);
 if(!known.size)return;
 try{checkpointWordJobs(storage,scope,[...known].map(bookId=>({bookId,title:'',ownerScope:scope,state:'queued',etaMs:null,completedUnits:0,totalUnits:1})))}catch{warnCheckpoint()}
 const [{isLocalBookSearchIndexReady},{localSearchBookFingerprint}]=await Promise.all([import('./engine/search_store'),import('./engine/word_volume_identity')]);if(currentLibraryIdentityScope()!==scope)return;
 await resumeWordCheckpoint({storage,canRun:backgroundDataInteractionAllowed,scope:currentLibraryIdentityScope,getBook,isWord:book=>inferBookFormat(book)==='word'&&book.managedSource!=='published',ready:isLocalBookSearchIndexReady,fingerprint:localSearchBookFingerprint,enqueue:(id,title,owner,revision)=>localBookIndexJobs.enqueue(id,title,owner,{revision,recheck:true})});
 }catch{warnCheckpoint()}
 }});
export function localIndexStatusPanel():HTMLElement{
 const panel=document.createElement('section');panel.className='local-index-status';panel.setAttribute('aria-live','polite');const scope=captureRouteResourceScope();
 const render=()=>{panel.replaceChildren();const jobs=localBookIndexJobs.snapshot();panel.hidden=jobs.length===0;for(const job of jobs){const row=document.createElement('div'),text=document.createElement('p');const status={queued:'في انتظار الفهرسة',running:'جارٍ فهرسة النص؛ الوقت المتبقي غير محدد',complete:'اكتملت الفهرسة',failed:'تعذّرت الفهرسة؛ يبقى الكتاب متاحًا للقراءة'};text.textContent=`${job.title}: ${status[job.state]}`;row.append(text);if(job.state==='running'||job.state==='queued'){const progress=document.createElement('progress');progress.max=1;progress.setAttribute('aria-label','تقدّم فهرسة الكتاب غير محدد');row.append(progress)}if(job.state==='failed'){const retry=document.createElement('button');retry.type='button';retry.textContent='إعادة محاولة الفهرسة';retry.style.minHeight='44px';retry.onclick=()=>localBookIndexJobs.enqueue(job.bookId,job.title);row.append(retry)}panel.append(row)}};
 const unsubscribe=localBookIndexJobs.subscribe(render);scope.add(unsubscribe);render();return panel;
}

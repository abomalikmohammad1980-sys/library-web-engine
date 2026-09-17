import {h} from './ui'
import {listDiscoveryBooks} from './discovery_books'
import {captureReadingIdentity} from './reading_identity_scope'
import {loadEditorialRecommendations,parseEditorialRecommendations} from './editorial_recommendations'
import {normalizeArabicSearch} from '../../packages/search/src/index'
export function editorialRecommendationsPanel():HTMLElement{
 const identity=captureReadingIdentity(),root=h('section',{class:'library-admin editorial-recommendations'},h('h2',null,'ترشيحات الإدارة للقراء')),status=h('p',{role:'status',class:'editorial-recommendations__status'})
 root.append(status)
 let loading=false;
 const load=()=>{
 if(loading||!identity.isCurrent())return;loading=true;status.textContent='جارٍ تحميل الترشيحات…';root.querySelector('[data-recommendations-retry]')?.remove();
 void Promise.all([listDiscoveryBooks(),loadEditorialRecommendations()]).then(([allBooks,config])=>{
  if(!identity.isCurrent())return
  status.textContent='';
  const books=allBooks.filter(book=>'publicSource' in book||book.managedSource==='published')
  let selectedId=''
  const search=h('input',{type:'search','aria-label':'الكتاب المرشح',placeholder:'بحث'}) as HTMLInputElement
  search.autocomplete='off'
  const matches=h('div',{class:'editorial-recommendations__matches',hidden:true})
  const indexed=books.map(book=>({book,text:normalizeArabicSearch(book.title+' '+book.author)}))
  const closeMatches=()=>{matches.replaceChildren();matches.hidden=true}
  search.oninput=()=>{
   selectedId='';add.disabled=true
   const words=normalizeArabicSearch(search.value).split(/\s+/).filter(Boolean)
   if(!words.length){closeMatches();return}
   const found=indexed.filter(item=>words.every(word=>item.text.includes(word))).slice(0,20)
   matches.replaceChildren(...found.map(({book})=>{
    const button=h('button',{type:'button',class:'btn btn--secondary',dataset:{noTranslate:''}},book.title+' — '+book.author) as HTMLButtonElement
    button.onclick=()=>{selectedId=book.id;search.value=book.title;add.disabled=false;closeMatches();search.focus()}
    return button
   }))
   if(!found.length)matches.append(h('p',{role:'status'},'لا توجد نتائج'))
   matches.hidden=false
  }
  search.onkeydown=event=>{if(event.key==='Escape')closeMatches();if(event.key==='ArrowDown'){event.preventDefault();matches.querySelector('button')?.focus()}}
  const start=h('input',{type:'date','aria-label':'بداية الظهور',value:new Date().toISOString().slice(0,10)}) as HTMLInputElement
  const end=h('input',{type:'date','aria-label':'نهاية الظهور',value:new Date(Date.now()+30*86400000).toISOString().slice(0,10)}) as HTMLInputElement
  const save=h('button',{type:'button',class:'btn btn--primary'},'حفظ الترشيحات') as HTMLButtonElement
  const add=h('button',{type:'button',class:'btn btn--secondary',disabled:true},'أضف إلى الترشيحات') as HTMLButtonElement
  const rows=h('div',{class:'editorial-recommendations__entries'})
  const render=()=>rows.replaceChildren(...config.entries.map(entry=>{const remove=h('button',{type:'button',class:'btn btn--secondary'},'إزالة');remove.onclick=()=>{config.entries=config.entries.filter(e=>e!==entry);render()};return h('p',null,h('span',{dataset:{noTranslate:''}},books.find(b=>b.id===entry.bookId)?.title??entry.bookId),h('span',{dir:'ltr',dataset:{noTranslate:''}},`${entry.start} — ${entry.end}`),remove)}))
  add.onclick=()=>{if(!selectedId||!start.value||!end.value||end.value<start.value){status.textContent='اختر كتابًا وفترة ظهور صحيحة.';return}config.entries=config.entries.filter(e=>e.bookId!==selectedId);config.entries.push({bookId:selectedId,start:start.value,end:end.value});render()}
  save.onclick=async()=>{
   if(!identity.isCurrent())return
   save.disabled=true;add.disabled=true
   root.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button').forEach(control=>control.disabled=true)
   try{const response=await fetch('/api/library/recommendations',{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json','x-alkhizana-request':'account-ui'},body:JSON.stringify(config),signal:AbortSignal.timeout(10000)});if(!identity.isCurrent())return;if(!response.ok){status.textContent=response.status===409?'تغيرت الترشيحات؛ أعد فتح الصفحة قبل الحفظ.':'تعذّر حفظ الترشيحات؛ بقيت اختياراتك هنا.';return}const result=parseEditorialRecommendations(await response.json());config.revision=result.revision;status.textContent='حُفظت الترشيحات؛ تتناوب يوميًا ضمن الفترة المحددة.'}catch{if(identity.isCurrent())status.textContent='تعذّر تأكيد حفظ الترشيحات. بقيت اختياراتك؛ أعد المحاولة، وإذا ظهر تعارض فأعد فتح الصفحة.'}finally{if(identity.isCurrent()){root.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button').forEach(control=>control.disabled=false);save.disabled=false;add.disabled=!selectedId}}
  }
  root.append(h('div',{class:'editorial-recommendations__fields'},h('div',{class:'editorial-recommendations__picker'},h('label',null,'الكتاب المرشح',search),matches),h('label',null,'بداية الظهور',start),h('label',null,'نهاية الظهور',end)),h('div',{class:'editorial-recommendations__footer'},rows,h('div',{class:'editorial-recommendations__actions'},add,save)));render()
 }).catch(()=>{if(!identity.isCurrent())return;status.textContent='تعذّر تحميل ترشيحات الإدارة؛ لم تتغير الترشيحات المحفوظة.';const retry=h('button',{type:'button',class:'btn btn--secondary',dataset:{recommendationsRetry:''}},'إعادة المحاولة');retry.onclick=load;root.append(retry)}).finally(()=>{loading=false})
 };load();
 return root
}

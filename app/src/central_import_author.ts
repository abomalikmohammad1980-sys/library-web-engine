import {h} from './ui'
import {isCentralAuthorId,loadCentralAuthors,canEditCentralAuthors} from './central_author_client'
import {centralAuthorForm} from './central_author_panel'
export interface CentralImportAuthor {id:string;name:string;deathYearHijri?:number|null;contemporary?:boolean}
function openAuthorEditor(signal:AbortSignal,onSaved:(author:CentralImportAuthor)=>void){
 if(signal.aborted||!canEditCentralAuthors())return ()=>{}
 const dialog=h('dialog',{'aria-label':'إضافة مؤلف للدليل العام',class:'person-section'}),close=h('button',{type:'button',class:'btn btn--secondary'},'إغلاق')
 const cleanup=()=>{signal.removeEventListener('abort',cleanup);dialog.remove()};close.onclick=cleanup
 dialog.append(close,centralAuthorForm((id,author)=>{if(signal.aborted)return;if(author){cleanup();onSaved({id,name:author.displayName,deathYearHijri:author.deathYearHijri,contemporary:author.contemporary})}}));dialog.addEventListener('close',cleanup,{once:true});signal.addEventListener('abort',cleanup,{once:true});document.body.append(dialog);dialog.showModal();return cleanup
}
export function centralAuthorCreateLauncher(signal:AbortSignal):HTMLElement{
 const host=h('span',null),button=h('button',{type:'button',class:'btn btn--secondary'},'إضافة مؤلف'),status=h('span',{role:'status'});let close=()=>{}
 button.onclick=()=>{close();close=openAuthorEditor(signal,({id,name})=>status.replaceChildren(h('a',{href:'#/people/'+encodeURIComponent(id),target:'_blank',rel:'noopener'},'تمت إضافة '+name)))}
 host.append(button,status);return host
}

/** Names are labels, never identity keys. Once edited, a selection must be made again. */
export function centralAuthorSelection(){
 let selected:{id:string;name:string}|undefined
 return {select(id:string,name:string){if(!isCentralAuthorId(id)||!name.trim())throw Error('مؤلف مركزي غير صالح');selected={id,name}},clear(){selected=undefined},current(name:string){if(selected?.name!==name)selected=undefined;return selected?.id}}
}
export function mountCentralImportAuthor(options:{authorInput:HTMLInputElement;signal:AbortSignal;onChange?:(author:CentralImportAuthor|undefined)=>void}){
 const {authorInput,signal}=options,state=centralAuthorSelection()
 const element=h('section',{class:'central-import-author','aria-label':'ربط المؤلف بالدليل العام'}),rows=h('div',null),status=h('p',{role:'status'})
 const search=h('button',{type:'button',class:'btn btn--secondary'},'اختيار مؤلف من الدليل العام')
 let request=0,active:AbortController|undefined,appliedName='',closeEditor=()=>{},hasSelection=false
 const select=(author:CentralImportAuthor)=>{if(signal.aborted)return;const {id,name}=author;++request;active?.abort();authorInput.value=name;state.select(id,name);hasSelection=true;rows.replaceChildren();closeEditor();status.replaceChildren(h('span',null,'تم ربط الكتاب بالمؤلف: '),h('a',{href:'#/people/'+encodeURIComponent(id),target:'_blank',rel:'noopener'},name));options.onChange?.({...author})}
 const clear=()=>{state.clear();hasSelection=false;++request;active?.abort();rows.replaceChildren();status.textContent='اختر المؤلف مجددًا بعد تعديل الاسم.';options.onChange?.(undefined)}
 authorInput.addEventListener('input',clear,{signal})
 signal.addEventListener('abort',()=>{++request;active?.abort();closeEditor()},{once:true})
 const load=async(page:number)=>{
  if(signal.aborted)return;active?.abort();active=new AbortController();const token=++request;status.textContent='جارٍ البحث في المؤلفين…'
  try{const result=await loadCentralAuthors(page,AbortSignal.any([signal,active.signal]),appliedName);if(signal.aborted||token!==request)return
   if(page===0)rows.replaceChildren();for(const row of result.authors){const button=h('button',{type:'button',class:'btn btn--secondary'},row.displayName+(row.contemporary?' — معاصر':row.deathYearHijri!==null?` — ${row.deathYearHijri} هـ`:''));button.onclick=()=>select({id:row.authorId,name:row.displayName,deathYearHijri:row.deathYearHijri,contemporary:row.contemporary});rows.append(button)}
   status.replaceChildren();if(result.hasMore){const more=h('button',{type:'button',class:'btn btn--secondary'},'مزيد من المؤلفين');more.onclick=()=>void load(page+1);status.append(more)}else if(!rows.childElementCount)status.textContent='لا توجد أسماء مطابقة؛ يمكنك إضافة المؤلف أدناه.'
  }catch{if(!signal.aborted&&token===request)status.textContent='تعذّر تحميل الدليل؛ أعد المحاولة قبل ربط المؤلف.'}
 }
 search.onclick=()=>{appliedName=authorInput.value.trim();void load(0)}
 element.append(search,rows,status)
 if(canEditCentralAuthors()){const create=h('button',{type:'button',class:'btn btn--secondary'},'إضافة مؤلف جديد');create.onclick=()=>{closeEditor();closeEditor=openAuthorEditor(signal,select)};element.append(create)}
 return {element,getCentralAuthorId:()=>{const id=state.current(authorInput.value);if(!id&&hasSelection)clear();return id}}
}

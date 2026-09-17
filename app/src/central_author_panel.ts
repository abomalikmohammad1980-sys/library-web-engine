import {unifiedAuthorForm} from './unified_author_form'
import {icon} from './icons'
import {shareBiography} from './biography_share'
import {setSourceDocumentTitle} from './translation'
import {currentAccountClaims} from './account_authority'
import {h} from './ui'
import {authorFieldCards} from './author_field_cards'
import {renderBiographyText} from './biography_format'
import {centralAuthorBooks} from './central_author_books'
import {canEditCentralAuthors,loadCentralAuthor,loadCentralAuthors,saveCentralAuthor,type CentralAuthor} from './central_author_client'
export function centralAuthorForm(onSaved:(id:string,author?:CentralAuthor)=>void,existing?:CentralAuthor):HTMLElement{
 const identity=currentAccountClaims()
 const fields={...existing?.fields};if(!Object.hasOwn(fields,'deathHijri'))fields.deathHijri=existing?.deathYearHijri??null
 const form=unifiedAuthorForm({canPublish:canEditCentralAuthors(),label:existing?'تحرير المؤلف':'إضافة مؤلف للدليل العام',initial:{displayName:existing?.displayName??'',biography:existing?.biography??'',fields,contemporary:existing?.contemporary??false},onSave:async value=>{
  if(!canEditCentralAuthors())throw Error('يلزم حساب محرر موثّق.')
  if(currentAccountClaims()?.subject!==identity?.subject||currentAccountClaims()?.sessionId!==identity?.sessionId)throw Error('تغيّر الحساب؛ افتح المحرر من جديد.')
  if(!value.publishPublic)throw Error('حدّد «نشر عام في الموقع» لتأكيد حفظ هذه الترجمة في الدليل العام.')
  const draft={displayName:value.displayName,biography:value.biography,fields:value.fields,deathYearHijri:value.fields.deathHijri??null,contemporary:value.contemporary,source:existing?.source??''}
  const result=await saveCentralAuthor(draft,existing);onSaved(result.authorId,{...draft,...result})
 }})
 form.classList.add('author-create')
 form.prepend(h('p',null,'هذه الترجمة مرتبطة بالدليل العام؛ يتطلب حفظها تحديد خيار النشر العام صراحةً.'))
 return form
}
export function centralAuthorsDirectory(signal:AbortSignal):HTMLElement{
 const host=h('section',{class:'person-section','aria-label':'المؤلفون المضافون للدليل المركزي'}),rows=h('div',{class:'authors-grid'}),status=h('p',{role:'status'})
 host.append(h('h2',null,'المؤلفون المضافون للدليل المركزي'),rows,status)
 if(canEditCentralAuthors()){host.prepend(h('a',{href:'#/authors?create=1',class:'btn btn--primary'},'إضافة مؤلف'))}
 const search=h('form',null),query=h('input',{type:'search',maxlength:300,'aria-label':'البحث في جميع المؤلفين المضافين مركزيًا',placeholder:'ابحث في جميع الإضافات المركزية'}) as HTMLInputElement
 search.append(query,h('button',{type:'submit',class:'btn btn--secondary'},'بحث في الإضافات المركزية'));host.insertBefore(search,rows)
 let requestId=0,active:AbortController|undefined,appliedQuery='';const seen=new Set<string>()
 signal.addEventListener('abort',()=>active?.abort(),{once:true})
 const load=async(page:number)=>{
  if(signal.aborted)return;active?.abort();active=new AbortController();const token=++requestId;status.textContent='جارٍ تحميل المؤلفين…'
  try{
   const result=await loadCentralAuthors(page,AbortSignal.any([signal,active.signal]),appliedQuery);if(signal.aborted||token!==requestId)return
   if(result.authors.some(row=>seen.has(row.authorId)))throw Error('تغيّر ترتيب الدليل؛ أعد تحميل الصفحة.')
   for(const row of result.authors){seen.add(row.authorId);rows.append(h('article',{class:'author-card'},h('a',{href:'#/people/'+encodeURIComponent(row.authorId),dataset:{noTranslate:''}},row.displayName),h('p',null,row.contemporary?'معاصر':row.deathYearHijri!==null?`توفي سنة ${row.deathYearHijri} هـ`:'سنة الوفاة غير موثقة')))}
   status.replaceChildren();if(result.hasMore){const more=h('button',{type:'button',class:'btn btn--secondary'},'تحميل مؤلفين آخرين');more.onclick=()=>void load(page+1);status.append(more)}else if(!seen.size)status.textContent=appliedQuery?'لا توجد أسماء مطابقة في الإضافات المركزية.':'لم يُضف مؤلفون مركزيون بعد.'
  }catch(error){if(signal.aborted||token!==requestId)return;const retry=h('button',{type:'button',class:'btn btn--secondary'},'إعادة المحاولة');retry.onclick=()=>void load(page);status.replaceChildren(h('span',null,'تعذّر تحميل الإضافات المركزية؛ بقية دليل المؤلفين متاحة.'),retry)}
 }
 search.onsubmit=event=>{event.preventDefault();appliedQuery=query.value.trim();seen.clear();rows.replaceChildren();void load(0)}
 void load(0);return host
}
export function centralAuthorPage(id:string,signal:AbortSignal):HTMLElement{
 const host=h('section',{class:'author-page','aria-busy':'true'},h('p',{role:'status'},'جارٍ تحميل المؤلف…'))
 const load=async()=>{try{const author=await loadCentralAuthor(id,signal);if(signal.aborted)return;host.removeAttribute('aria-busy');const body=h('section',{class:'person-section'},h('h2',null,'الترجمة المفصلة'),h('div',{class:'person-biography',dataset:{noTranslate:''}},...renderBiographyText(author.biography)))
 setSourceDocumentTitle(`${author.displayName} — الخِزانة`)
 const actions=h('div',{class:'person-hero__actions','aria-label':'إجراءات صفحة المؤلف'},h('button',{type:'button',class:'btn btn--secondary person-share','aria-label':'مشاركة الترجمة',title:'مشاركة الترجمة',onclick:()=>void shareBiography(author.displayName,new URL(`#/people/${encodeURIComponent(id)}`,location.href).href,{share:navigator.share?.bind(navigator),copy:navigator.clipboard?.writeText.bind(navigator.clipboard)})},icon('share',21)))
 host.replaceChildren(h('div',{class:'author-hero person-hero'},h('a',{href:'#/authors'},'المؤلفون ←'),h('h1',{class:'page-title',dataset:{noTranslate:''}},author.displayName),h('p',null,author.contemporary?'معاصر':author.deathYearHijri!==null?`توفي سنة ${author.deathYearHijri} هـ`:'سنة الوفاة غير موثقة'),actions),body,centralAuthorBooks(id,signal))
 body.before(authorFieldCards(author.fields))
 if(canEditCentralAuthors()){const edit=h('button',{type:'button',class:'btn btn--secondary person-edit','aria-label':'تحرير الترجمة',title:'تحرير الترجمة'},icon('edit',21));edit.onclick=()=>{if(!canEditCentralAuthors())return;host.querySelector('.author-create')?.remove();host.append(centralAuthorForm(()=>void load(),author))};actions.append(edit)}
 }catch(error){if(signal.aborted)return;host.removeAttribute('aria-busy');const retry=h('button',{type:'button',class:'btn btn--secondary'},'إعادة المحاولة');retry.onclick=()=>void load();host.replaceChildren(h('p',{role:'status'},'تعذّر تحميل المؤلف المركزي.'),retry)}}
 const changed=()=>{host.querySelector('.author-create')?.remove();host.querySelector('.person-edit')?.remove();void load()}
 window.addEventListener('alkhizana:account-changed',changed);signal.addEventListener('abort',()=>window.removeEventListener('alkhizana:account-changed',changed),{once:true})
 void load();return host
}

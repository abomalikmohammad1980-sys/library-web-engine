import {h} from './ui'
import {renderBiographyText} from './biography_format'
import {currentAccountClaims} from './account_authority'
import {captureRouteResourceScope} from './resource_lifecycle'
import {AuthorOverrideValidationError,loadAuthorOverride,loadAuthorOverrideHistory,type AuthorOverride,type AuthorOverrideBaseline} from './author_override_client'
import {validateAuthorOverrideDraft,authorOverrideIssueMessage,type AuthorOverrideIssue} from './author_override_validation'
import {validAuthorStructuredFields,type AuthorStructuredFields} from './author_structured_fields'
import {icon} from './icons'
import {setSourceDocumentTitle} from './translation'
import {mountAuthorInlineFields} from './author_inline_fields'
import {saveRebasedAuthorOverride} from './author_override_rebase'
import {authorFieldsHistory} from './author_field_cards'
import {uiTemplateText} from './ui_template_binding'
export function authorOverridePermissions(claims:{role?:string}|null|undefined){return{edit:claims?.role==='editor'||claims?.role==='super-admin',history:claims?.role==='super-admin'}}
export function sameAuthorEditorIdentity(captured:{subject:string;sessionId?:string},current:{subject:string;sessionId?:string;role?:string}|null|undefined):boolean{return !!current&&current.subject===captured.subject&&current.sessionId===captured.sessionId&&authorOverridePermissions(current).edit}

/** Uses an exact catalog identity or the stable local-ID digest; never matches names. */
export function attachAuthorOverride(content:HTMLElement,authorId:string,originalName:string,initial?:AuthorOverrideBaseline,originalFields:AuthorStructuredFields={}):void{
 const scope=captureRouteResourceScope(),controller=new AbortController()
 scope.add(()=>controller.abort())
 const active=()=>!scope.disposed&&!controller.signal.aborted
 const actions=content.querySelector('.person-hero__actions'),body=content.querySelector('.person-page__body')
 if(!actions||!body)return
 const original=content.querySelector('.person-biography')
 const originalText=(original as HTMLElement|null)?.innerText??original?.textContent??''
 let revision:number|undefined,current:AuthorOverride|null=null,form:HTMLFormElement|undefined
 let closeInline:(()=>void)|undefined
 const clearInline=()=>{closeInline?.();closeInline=undefined}
 scope.add(clearInline)
 const status=h('p',{role:'status',class:'page-sub'}),edit=h('button',{type:'button',class:'btn btn--secondary person-edit','aria-label':'تحرير الترجمة',title:'تحرير الترجمة'},icon('edit',21))
 const historyButton=h('button',{type:'button',class:'btn btn--secondary'},'سجل نسخ الترجمة')
 let historyPanel:HTMLElement|undefined,historyController:AbortController|undefined
 const closeHistory=()=>{historyController?.abort();historyController=undefined;historyPanel?.remove();historyPanel=undefined}
 scope.add(()=>{closeHistory();historyButton.remove()})
 window.addEventListener('popstate',closeHistory)
 scope.add(()=>window.removeEventListener('popstate',closeHistory))
 edit.hidden=true;actions.append(edit);actions.append(status)
 const allowed=()=>authorOverridePermissions(currentAccountClaims()).edit
 const refreshPermission=()=>{if(allowed()){edit.hidden=false;if(!edit.isConnected)actions.prepend(edit)}else{edit.remove();form?.remove();form=undefined};if(authorOverridePermissions(currentAccountClaims()).history){if(!historyButton.isConnected)actions.append(historyButton)}else{historyButton.remove();closeHistory()}}
 const accountChanged=()=>{closeHistory();clearInline();form?.remove();form=undefined;refreshPermission()}
 window.addEventListener('alkhizana:account-changed',accountChanged)
 scope.add(()=>window.removeEventListener('alkhizana:account-changed',accountChanged))
 historyButton.onclick=()=>{
  const claims=currentAccountClaims()
  if(!active()||!claims||!authorOverridePermissions(claims).history||historyPanel)return
  const requestController=new AbortController(),route=routeLocation.hash
  historyController=requestController
  const stillAllowed=()=>active()&&!requestController.signal.aborted&&historyController===requestController&&routeLocation.hash===route&&sameAuthorEditorIdentity(claims,currentAccountClaims())&&authorOverridePermissions(currentAccountClaims()).history
  const close=h('button',{type:'button',class:'btn btn--secondary'},'إغلاق السجل'),older=h('button',{type:'button',class:'btn btn--secondary',hidden:true},'عرض نسخة أقدم')
  const message=h('p',{role:'status'}),entries=h('div',null)
  const panel=h('section',{class:'person-section',dataset:{authorHistory:''}},h('h2',null,'سجل نسخ الترجمة'),close,message,entries,older)
  historyPanel=panel;body.prepend(panel);close.onclick=closeHistory
  let cursor:number|undefined,busy=false
  const loadPage=async()=>{
   if(!stillAllowed()||busy)return
   busy=true;older.disabled=true;message.textContent='جارٍ تحميل السجل…'
   try{
    const page=await loadAuthorOverrideHistory(authorId,cursor,{signal:requestController.signal})
    if(!stillAllowed())return
    entries.replaceChildren(...page.history.map(row=>h('article',null,
     h('h3',null,uiTemplateText('16c6c8d60d76cda2',{p1:row.revision,p2:row.displayName})),
     h('div',{class:'author-history-biography',dataset:{noTranslate:''}},...renderBiographyText(row.biography)),
     h('p',null,'المصدر: ',h('span',{dataset:{noTranslate:''}},row.source)),
     h('p',null,'سبب التعديل: ',h('span',{dataset:{noTranslate:''}},row.reason)),
     h('p',null,h('time',{dataset:{noTranslate:''}},row.createdAt)),authorFieldsHistory(row.fields))))
    cursor=page.nextBeforeVersion??undefined;older.hidden=!page.hasMore
    message.textContent=page.history.length?'':'لا توجد نسخ سابقة.'
   }catch{if(stillAllowed()){message.textContent='تعذّر تحميل السجل؛ أعد المحاولة.';older.hidden=false}}
   finally{busy=false;if(stillAllowed())older.disabled=false}
  }
  older.onclick=()=>{void loadPage()};void loadPage()
 }
 const apply=(row:AuthorOverride)=>{
  const title=content.querySelector('#person-title');if(title)title.textContent=row.displayName
  setSourceDocumentTitle(`${row.displayName} — الخِزانة`)
  const node=h('div',{class:'person-biography',dataset:{noTranslate:''}},...renderBiographyText(row.biography),...(row.source.trim()?[h('p',{class:'page-sub'},`المصدر: ${row.source}`)]:[]))
  const old=content.querySelector('.person-biography');if(old)old.replaceWith(node);else body.append(h('section',{class:'person-section'},h('h2',null,'الترجمة المفصلة'),node))
 }
 const load=async()=>{
  try{const row=await loadAuthorOverride(authorId,{signal:controller.signal});if(!active())return;current=row;revision=row?.revision??0;if(row)apply(row);status.textContent='';refreshPermission()}
  catch{if(active()){revision=undefined;status.textContent=allowed()?'تعذّر تحميل النسخة المركزية؛ الترجمة الأصلية باقية، والتحرير غير متاح حتى التحقق من النسخة.':'';refreshPermission()}}
 }
 edit.onclick=()=>{
  if(!active()||!allowed())return
  if(revision===undefined){void load();return}
  if(form)return
  const claims=currentAccountClaims()!,sameIdentity=()=>active()&&sameAuthorEditorIdentity(claims,currentAccountClaims())
  const name=h('input',{value:current?.displayName??originalName}) as HTMLInputElement;name.required=true;name.maxLength=300
  const text=h('textarea',null) as HTMLTextAreaElement;text.maxLength=20000;text.rows=14;text.value=current?.biography??originalText
  const source=h('textarea',null) as HTMLTextAreaElement;source.maxLength=2000;source.rows=2;source.value=current?.source??''
  const reason=h('textarea',null) as HTMLTextAreaElement;reason.maxLength=1000;reason.rows=2
  const save=h('button',{type:'submit',class:'btn btn--primary'},'حفظ التعديلات'),cancel=h('button',{type:'button',class:'btn btn--secondary'},'إلغاء')
  const message=h('p',{role:'status'}),reload=h('button',{type:'button',class:'btn btn--secondary',hidden:true},'عرض النسخة الأحدث للمقارنة')
  const baseline=revision
  const field=(label:string,input:HTMLElement)=>h('label',{style:'display:grid;gap:.25rem;min-width:0'},label,input)
  form=h('form',{id:`author-inline-${authorId.replace(/[^a-zA-Z0-9]/g,'-')}`,class:'author-inline-toolbar'},save,cancel,h('details',null,h('summary',null,'المصدر وسبب التعديل (اختياري)'),field('المصدر العام (اختياري)',source),field('سبب التعديل (اختياري)',reason)),reload,message) as HTMLFormElement
  const editor=form;actions.prepend(editor)
  const inline=mountAuthorInlineFields(content,editor,{...originalFields,...current?.fields},name,text);closeInline=inline.close
  const originalDraft={expectedVersion:baseline,displayName:name.value,biography:text.value,source:source.value,reason:'',fields:structuredClone({...originalFields,...current?.fields})}
  cancel.onclick=()=>{clearInline();editor.remove();if(form===editor)form=undefined}
  reload.onclick=async()=>{if(!sameIdentity())return;try{const latest=await loadAuthorOverride(authorId,{signal:controller.signal});if(!sameIdentity())return;message.replaceChildren(h('p',null,'المسودة محفوظة في الحقول. هذه النسخة الأحدث؛ أغلق المحرر وافتحه من جديد بعد المقارنة.'),h('pre',null,...(latest?[h('span',{dataset:{noTranslate:''}},`${latest.displayName}\n${latest.biography}`),'\n',h('span',null,'المصدر:'),' ',h('span',{dataset:{noTranslate:''}},latest.source)]:['لا توجد نسخة مركزية.'])));current=latest;revision=latest?.revision??0}catch{if(sameIdentity())message.textContent='تعذّر تحميل النسخة الأحدث؛ لم تُغيّر المسودة.'}}
  editor.onsubmit=async event=>{
   event.preventDefault();if(!sameIdentity()||save.disabled)return
   const draft={expectedVersion:baseline,displayName:name.value,biography:text.value,source:source.value,reason:reason.value,fields:inline.read()}
   const effective={...originalFields,...current?.fields,...draft.fields}
   const invalidDates=Object.keys(draft.fields).some(key=>/^(birth|death)(Hijri|Gregorian)$/.test(key))&&[[effective.birthHijri,effective.deathHijri],[effective.birthGregorian,effective.deathGregorian]].some(([birth,death])=>birth!=null&&death!=null&&death<birth)
   if(!validAuthorStructuredFields(draft.fields)||invalidDates){message.textContent='تحقق من التواريخ: الوفاة لا تسبق الميلاد. القوائم حتى 50 سطرًا، وكل سطر حتى 300 حرف (500 للمؤلفات). لا تُقبل أكواد HTML. لم تُفقد المسودة.';return}
   const showIssue=(issue:AuthorOverrideIssue)=>{message.textContent=authorOverrideIssueMessage(issue);const control={displayName:name,biography:text,source,reason}[issue.field as 'displayName'|'biography'|'source'|'reason'];if(control){control.setAttribute('aria-invalid','true');control.focus()}}
   for(const control of [name,text,source,reason])control.removeAttribute('aria-invalid')
   const issue=validateAuthorOverrideDraft(draft);if(issue){showIssue(issue);return}
   save.disabled=true;message.textContent='جارٍ حفظ الترجمة…'
   try{const saved=await saveRebasedAuthorOverride(authorId,originalDraft,draft,{signal:controller.signal,canSave:sameIdentity}),next=saved.revision;if(!sameIdentity())return
    current={authorId,displayName:saved.draft.displayName.trim(),biography:saved.draft.biography.trim(),source:saved.draft.source.trim(),revision:next,updatedAt:new Date().toISOString(),fields:{...saved.latest?.fields,...saved.draft.fields}};revision=next;clearInline();apply(current);editor.remove();form=undefined;status.textContent='حُفظت الترجمة المركزية.';window.dispatchEvent(new PopStateEvent('popstate'))
   }catch(error){if(!sameIdentity())return;const code=error instanceof Error?error.message:''
    message.textContent=code==='author_override_conflict'?'تزامنت تحديثات متتابعة أثناء الحفظ. بقيت مسودتك؛ اضغط حفظ للمحاولة مجددًا.':code==='super_admin_required'?'تعذّر التحقق من صلاحية المدير العام. لم يُحفظ التعديل.':code==='invalid_author_override'?'تحقق من الاسم والترجمة وحدود الطول. المصدر والسبب اختياريان؛ يُسمح بالتنسيق النصي دون أكواد HTML.':'تعذّر تأكيد الحفظ. احتفظ بمسودتك وتحقق من النسخة الأحدث قبل إعادة المحاولة.'
    if(error instanceof AuthorOverrideValidationError&&error.issue)showIssue(error.issue)
    reload.hidden=code==='invalid_author_override'&&!(error instanceof AuthorOverrideValidationError&&error.issue?.field==='expectedVersion')
   }finally{if(sameIdentity())save.disabled=false}
  }
 }
 if(initial){
  if('row' in initial){current=initial.row;revision=current?.revision??0;if(current)apply(current)}
  else{revision=undefined;status.textContent='تعذّر التحقق من آخر تعديل مركزي؛ المعروض من المصادر الأصلية والتحرير ينتظر التحقق.'}
  refreshPermission()
 }else{refreshPermission();void load()}
}
import {routeLocation} from "./path_location"

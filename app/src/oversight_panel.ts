import {h} from './ui'
import {pageJump} from './page_jump'
import {uiTemplateText,uiDateParameter} from './ui_template_binding'
import {resolveUiLabel} from './ui_dictionary_loader'
import {icon} from './icons'
import './styles/oversight.css'
import {currentAccountClaims} from './account_authority'
import {loadOversight,loadOversightActors,undoOversight,loadOversightInbox,type OversightEvent} from './oversight_client'
const labels:Record<string,string>={name:'اسم التصنيف',title:'العنوان',author:'المؤلف',display_name:'الاسم',biography:'الترجمة',source:'التوثيق',category:'التصنيف',visibility:'الظهور',review_status:'حالة المراجعة',review_note:'ملاحظة المراجعة',death_year_hijri:'الوفاة الهجرية',contemporary:'معاصر',deleted_at:'تاريخ الحذف',logically_deleted_at:'تاريخ الحذف',hidden_at:'تاريخ الإخفاء',disabled:'معطّل',role:'الصلاحية',blocked:'محظور',reason:'السبب'}
export function oversightDisplayFields(value:Record<string,unknown>|null|undefined):Array<[string,string]>{const values:Record<string,string>={public:'عام',private:'خاص',hidden:'مخفي',unlisted:'غير مدرج',pending:'بانتظار المراجعة',approved:'مقبول',rejected:'مرفوض',user:'مستخدم',editor:'محرر',admin:'مدير مراجعة'};return Object.entries(value??{}).filter(([key,v])=>Object.hasOwn(labels,key)&&(v===null||['string','number','boolean'].includes(typeof v))).map(([key,v])=>[labels[key]!,v===null?'غير محدد':typeof v==='boolean'||key==='blocked'&&(v===0||v===1)?v?'نعم':'لا':['visibility','review_status','role'].includes(key)&&typeof v==='string'&&Object.hasOwn(values,v)?values[v]!:String(v)])}
const savedTextFields=['name','title','author','display_name','biography','source','category','review_note','reason'] as const
function snapshot(title:string,value:Record<string,unknown>|null|undefined){const fields=oversightDisplayFields(value);return h('section',null,h('h4',null,title),...(fields.length?fields.map(([key,text])=>{
 const savedText=savedTextFields.some(field=>labels[field]===key&&typeof value?.[field]==='string')
 return h('p',null,h('strong',null,h('span',null,key),': '),savedText?h('span',{dataset:{noTranslate:''}},text):text)
}):[h('p',null,'لا توجد بيانات معروضة.')]))}
function lifecycle(){const controller=new AbortController(),claims=currentAccountClaims();const check=()=>{const active=currentAccountClaims();if(active?.subject!==claims?.subject||active?.sessionId!==claims?.sessionId)controller.abort()};window.addEventListener('popstate',()=>controller.abort(),{once:true});window.addEventListener('alkhizana:account-changed',check,{signal:controller.signal});return controller.signal}
export function oversightPanel(onChanged?:()=>void):HTMLElement{
 const host=h('section',{class:'library-admin oversight-panel','aria-label':'متابعة أعمال الإدارة'});if(currentAccountClaims()?.role!=='super-admin')return host
 const signal=lifecycle(),rows=h('div',null),status=h('p',{role:'status'}),select=h('select',{'aria-label':'تصفية أعمال منفذ محدد'},h('option',{value:''},'جميع المنفذين')) as HTMLSelectElement,search=h('input',{type:'search','aria-label':'البحث باسم المنفذ',placeholder:'ابحث باسم المنفذ'}) as HTMLInputElement
 const actorPicker=h('div',{class:'oversight-actor-picker'},select)
 host.append(h('h2',null,'متابعة أعمال الإدارة'),h('p',{class:'oversight-hint'},'تُنشر الأعمال المصرّح بها مباشرة. يمكنك مراجعة التغييرات والتراجع عن المتاح منها مع إرسال السبب إلى منفذها.'),h('div',{class:'oversight-filters'},h('label',null,icon('search',17),search),actorPicker),rows,status)
 let ticket=0,actor='',page=0,busy=false;const members=new Map<string,string>(),seen=new Set<number>()
 const renderMembers=()=>{const selected=select.value;select.replaceChildren(h('option',{value:''},'جميع المنفذين'));for(const [id,name]of members)if(name.includes(search.value.trim())||id===selected)select.append(h('option',{value:id,dataset:{noTranslate:''}},name));select.value=selected}
 const membersMore=h('button',{type:'button',class:'btn btn--secondary'},icon('plus',16),'عرض المزيد من الأسماء');membersMore.hidden=true;let memberPage=0
 const loadMembers=async()=>{membersMore.disabled=true;try{const result=await loadOversightActors(memberPage,{signal});if(signal.aborted)return;for(const member of result.actors)members.set(member.id,member.name);renderMembers();membersMore.hidden=!result.hasMore;memberPage++}catch{membersMore.hidden=false;membersMore.textContent='إعادة تحميل أسماء المنفذين'}finally{membersMore.disabled=false}};membersMore.onclick=()=>void loadMembers();actorPicker.append(membersMore);search.oninput=renderMembers
 const load=async(next:number)=>{
  const token=++ticket,selectedActor=actor;rows.replaceChildren();seen.clear();status.textContent='جارٍ تحميل السجل…'
  try{
   const result=await loadOversight(next,selectedActor,{signal});if(signal.aborted||token!==ticket)return
   for(const event of result.events){if(seen.has(event.id))throw Error('duplicate');seen.add(event.id);rows.append(eventRow(event))}
   page=next;status.replaceChildren();if(!seen.size)status.append(h('span',null,'لا توجد أحداث مطابقة.'))
   const pages=Math.max(1,result.total===undefined?page+1+Number(result.hasMore):Math.ceil(result.total/30)),nav=h('nav',{class:'admin-accounts__pagination','aria-label':'صفحات أعمال الإدارة'})
   const go=(index:number,label:string,disabled=false)=>h('button',{type:'button',class:'btn btn--secondary',disabled,'aria-current':index===page?'page':undefined,onclick:()=>void load(index)},label)
   nav.append(go(Math.max(0,page-1),'السابق',page===0))
   const indices=new Set([0,pages-1]);for(let i=Math.max(0,page-2);i<=Math.min(pages-1,page+2);i++)indices.add(i)
   let last=-1;for(const i of [...indices].sort((a,b)=>a-b)){if(last>=0&&i-last>1)nav.append(h('span',null,'…'));nav.append(go(i,String(i+1),i===page));last=i}
   nav.append(go(page+1,'التالي',!result.hasMore));const jump=pageJump('أعمال الإدارة',index=>{void load(index)});jump.update(page,pages);nav.append(jump.element);status.append(h('span',null,'30 عملية في الصفحة'),nav)
  }catch{if(!signal.aborted&&token===ticket){rows.replaceChildren();status.replaceChildren(h('span',null,'تعذّر تحميل السجل.'),h('button',{type:'button',class:'btn btn--secondary',onclick:()=>void load(next)},'إعادة المحاولة'))}}
 }
 function eventRow(event:OversightEvent){
  const message=h('p',{role:'status'}),details=h('details',null,h('summary',null,icon('list',17),'عرض ما قبل التغيير وما بعده'),snapshot('قبل التغيير',event.before),snapshot('بعد التغيير',event.after)),row=h('article',{class:'oversight-event'},h('div',{class:'oversight-event__heading'},h('h3',null,icon('check',18),h('span',{dataset:{noTranslate:''}},event.summary)),h('span',{class:'oversight-event__actor',dataset:{noTranslate:''}},event.actorName),h('time',{dir:'auto',title:event.createdAt,dataset:{uiText:''}},uiTemplateText('e247c72af5db1232',{p1:uiDateParameter(event.createdAt,{dateStyle:'short',timeStyle:'medium'})}))),details,message)
  if(event.canUndo&&!event.undone){const reason=h('textarea',{'aria-label':'سبب التراجع',placeholder:'اكتب السبب الذي سيُرسل إلى المنفذ',maxlength:1000}) as HTMLTextAreaElement;reason.rows=2;const button=h('button',{type:'button',class:'btn btn--secondary'},icon('arrow-back',17),'التراجع عن هذا التغيير') as HTMLButtonElement;row.append(h('details',{class:'oversight-event__undo'},h('summary',null,icon('arrow-back',17),'التراجع مع توضيح السبب'),h('div',{class:'oversight-event__undo-controls'},reason,button)));button.onclick=async()=>{if(busy||signal.aborted)return;if(!reason.value.trim()){message.textContent='اكتب سبب التراجع أولًا.';reason.focus();return}const confirmation=await resolveUiLabel('هل تؤكد التراجع عن هذا التغيير؟ سيُخطر منفذه بالسبب.',document.documentElement.lang||'ar');if(busy||signal.aborted||!window.confirm(confirmation))return;busy=true;button.disabled=true;try{await undoOversight(event.id,event.revision,reason.value,{signal});message.textContent='تم التراجع وإخطار المنفذ.';reason.disabled=true;button.remove();onChanged?.()}catch(error){message.textContent=error instanceof Error&&error.message==='oversight_conflict'?'تغيّر المورد بعد هذه العملية؛ حدّث السجل قبل اتخاذ قرار جديد.':'تعذّر تأكيد التراجع؛ حدّث السجل للتحقق قبل إعادة المحاولة.';button.disabled=true;const refresh=h('button',{type:'button',class:'btn btn--secondary'},'تحديث السجل');refresh.onclick=()=>void load(0);message.append(refresh)}finally{busy=false}}
  }else row.append(h('p',null,event.undone?'تم التراجع عن هذه العملية.':event.unsupportedReason?'لا يمكن التراجع الآلي عن هذه العملية.':'هذا السجل للقراءة فقط.'))
  const detailSummary=details.querySelector('summary')!
  detailSummary.title='عرض ما قبل التغيير وما بعده'
  detailSummary.replaceChildren(icon('list',17),'التفاصيل')
  const undoSummary=row.querySelector('.oversight-event__undo > summary')
  if(undoSummary){undoSummary.setAttribute('title','التراجع مع توضيح السبب');undoSummary.replaceChildren(icon('arrow-back',17),'التراجع')}
  return row
 }
 select.onchange=()=>{actor=select.value;void load(0)};void loadMembers();void load(0);return host
}
export function oversightInbox():HTMLElement{
 const host=h('section',{class:'oversight-panel','aria-label':'إشعارات مراجعة الأعمال'},h('h3',null,'إشعارات مراجعة الأعمال')),rows=h('div',null),status=h('p',{role:'status'}),signal=lifecycle();host.append(rows,status);let busy=false;const seen=new Set<number>()
 const load=async(page:number)=>{if(busy||signal.aborted)return;busy=true;status.textContent='جارٍ تحميل الإشعارات…';try{const result=await loadOversightInbox(page,{signal});if(signal.aborted)return;for(const item of result.notifications){if(seen.has(item.id))throw Error();seen.add(item.id);rows.append(h('article',{class:'oversight-event'},h('p',{dataset:{noTranslate:''}},item.message),h('p',null,h('span',null,'السبب:'),' ',h('span',{dataset:{noTranslate:''}},item.reason)),h('small',{dataset:{uiText:''}},uiTemplateText('e247c72af5db1232',{p1:uiDateParameter(item.createdAt,{dateStyle:'short',timeStyle:'medium'})}))))}status.replaceChildren();if(result.hasMore){const more=h('button',{type:'button',class:'btn btn--secondary'},'إشعارات أقدم');more.onclick=()=>void load(page+1);status.append(more)}else if(!seen.size)status.textContent='لا توجد إشعارات مراجعة جديدة.'}catch{if(!signal.aborted)status.replaceChildren(h('span',null,'تعذّر تحميل الإشعارات.'),h('button',{type:'button',onclick:()=>void load(page)},'إعادة المحاولة'))}finally{busy=false}}
 void load(0);return host
}

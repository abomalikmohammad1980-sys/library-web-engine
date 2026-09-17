import {h} from './ui'
import {uiTemplateText,uiNumberParameter,uiRegionParameter,uiDateParameter,uiLabelParameter} from './ui_template_binding'
import {icon} from './icons'
import {currentAccountClaims} from './account_authority'
import {captureRouteResourceScope} from './resource_lifecycle'
export function parseAudience(v:any){
 if(!v||![v.total,v.legacyBaseline,v.sample].every(n=>Number.isSafeInteger(n)&&n>=0)||!Array.isArray(v.countries)||v.countries.length>676||!Number.isFinite(Date.parse(v.updatedAt)))throw Error('invalid')
 const seen=new Set();let sum=0
 for(const r of v.countries){if(!r||! /^[A-Z]{2}$/.test(r.country)||seen.has(r.country)||!Number.isSafeInteger(r.count)||r.count<1)throw Error('invalid');seen.add(r.country);sum+=r.count}
 if(sum!==v.sample||v.sample>v.total)throw Error('invalid')
 const age=v.age;if(!age||!Number.isSafeInteger(age.participants)||age.participants<0||!Number.isSafeInteger(age.accounts)||age.accounts<age.participants||!(age.average===null||age.participants>=5&&Number.isFinite(age.average)&&age.average>=0&&age.average<=120)||!Array.isArray(age.bands)||age.bands.length>6||age.bands.some((r:any)=>!['under18','18-24','25-34','35-44','45-54','55plus'].includes(r.band)||!Number.isSafeInteger(r.count)||r.count<5))throw Error('invalid')
 if(new Set(age.bands.map((r:any)=>r.band)).size!==age.bands.length||age.bands.reduce((sum:number,r:any)=>sum+r.count,0)>age.participants)throw Error('invalid')
 return v as {total:number;legacyBaseline:number;sample:number;countries:{country:string;count:number}[];updatedAt:string;age:{participants:number;accounts:number;average:number|null;bands:{band:string;count:number}[]}}
}
export function adminAudiencePanel():HTMLElement{
 const host=h('section',{class:'library-admin admin-audience','aria-label':'إحصاءات الجمهور'}),claims=currentAccountClaims()
 if(claims?.role!=='super-admin')return host
 const scope=captureRouteResourceScope(),abort=new AbortController();scope.add(()=>abort.abort())
 const active=()=>!scope.disposed&&currentAccountClaims()?.role==='super-admin'&&currentAccountClaims()?.subject===claims.subject&&currentAccountClaims()?.sessionId===claims.sessionId
 const content=h('div',null),status=h('p',{role:'status'}),period=h('select',{'aria-label':'فترة إحصاءات الجمهور'},...([['7','آخر 7 أيام'],['30','آخر 30 يومًا'],['90','آخر 90 يومًا'],['all','كل المدة']] as const).map(([value,label])=>h('option',{value,selected:value==='30'},label))) as HTMLSelectElement
 const refresh=h('button',{type:'button',class:'btn btn--secondary'},icon('repeat',17),'تحديث')
 const visitorValue=h('bdi',{class:'admin-audience__visitor-value',dir:'ltr'},'—')
 const visitorTotal=h('span',{class:'admin-audience__visitor-total','aria-live':'polite','aria-atomic':'true'},h('span',null,'عدد الزوار'),visitorValue)
 host.append(h('div',{class:'admin-audience__heading'},h('h2',null,h('span',null,'إحصاءات الجمهور'),visitorTotal),period,refresh),h('p',{class:'admin-archive-help'},'زوار جدد مميّزون بملف المتصفح، وليس عدد أشخاص مؤكدًا. حذف ملفات الارتباط أو استخدام جهاز آخر قد يكرر العد. البلد تقريبي بحسب الشبكة وقد يتأثر بـVPN؛ لا نحفظ عنوان IP أو الموقع الدقيق.'),content,status)
 let busy=false
 const load=async()=>{if(busy||!active())return;busy=true;refresh.disabled=true;const selected=period.value
 try{const response=await fetch('/api/visitors?period='+selected,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(10000)])});if(!response.ok)throw Error('unavailable')
  const reader=response.body?.getReader();if(!reader)throw Error('body');const parts:Uint8Array[]=[];let size=0
  try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>64000)throw Error('large');parts.push(p.value)}}finally{await reader.cancel();reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length}
  const data=parseAudience(JSON.parse(new TextDecoder().decode(bytes)));if(!active()||period.value!==selected)return
  visitorValue.textContent=new Intl.NumberFormat('en',{maximumFractionDigits:0,useGrouping:true}).format(data.total)
  const number=(n:number)=>uiNumberParameter(n,{maximumFractionDigits:0,useGrouping:true}),decimal=(n:number)=>uiNumberParameter(n,{maximumFractionDigits:1,useGrouping:true})
  const metric=(label:string,value:Node|string)=>h('div',{class:'admin-dashboard__stat'},h('strong',null,value),h('span',null,label))
  const known=data.countries.filter(r=>r.country!=='XX').reduce((n,r)=>n+r.count,0)
  content.replaceChildren(
   h('div',{class:'admin-audience__metrics'},
    metric('متصفحات مسجلة فعليًا',uiTemplateText('e247c72af5db1232',{p1:number(data.total)})),
    metric('زوار جدد في الفترة',uiTemplateText('e247c72af5db1232',{p1:number(data.sample)})),
    metric('نسبة البلد المعروف',data.sample?uiTemplateText('070f4fa0e9ebb7ff',{p1:number(Math.round(known/data.sample*100))}):'—'),
    metric('متوسط عمر المشاركين التقريبي',data.age.average===null?'عينة غير كافية':uiTemplateText('783c644fae78f9b1',{p1:decimal(data.age.average)}))),
   h('p',{class:'admin-archive-help'},uiTemplateText('563750fc5f3b8ee2',{p1:number(data.age.participants),p2:number(data.age.accounts),p3:decimal(data.age.accounts?data.age.participants/data.age.accounts*100:0),p4:number(data.legacyBaseline)})),
   h('div',{class:'admin-audience__countries'},...(data.countries.length?data.countries.map(r=>h('div',{class:'admin-audience__country'},
    h('strong',null,r.country==='XX'?'بلد غير متاح':uiTemplateText('e247c72af5db1232',{p1:uiRegionParameter(r.country)})),
    h('span',{class:'admin-audience__bar','aria-hidden':'true'},h('span',{style:'width:'+r.count/data.sample*100+'%'})),
    h('span',null,uiTemplateText('83e7dd71192f1ff9',{p1:number(r.count),p2:decimal(r.count/data.sample*100)})))):[h('p',null,'لا توجد زيارات مسجلة في الفترة المحددة.')]))
  )
  content.append(h('h3',null,'الفئات العمرية المشاركة'),...data.age.bands.map(r=>h('p',null,uiTemplateText('1daebe95c0824923',{p1:r.band==='under18'?uiLabelParameter('أقل من 18'):r.band==='55plus'?uiLabelParameter('55 فأكثر'):r.band,p2:number(r.count),p3:decimal(r.count/data.age.participants*100)}))))
  status.replaceChildren(uiTemplateText('c24795ce41329bfc',{p1:uiDateParameter(data.updatedAt,{dateStyle:'short',timeStyle:'medium'})}))
 }catch{if(active())status.textContent='تعذّر تحديث إحصاءات الجمهور؛ لم نعرض أرقامًا تقديرية.'}finally{busy=false;refresh.disabled=false;if(active()&&period.value!==selected)void load()}}
 period.onchange=()=>void load();refresh.onclick=()=>void load()
 const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load()},60000);scope.add(()=>clearInterval(timer))
 const changed=()=>{if(!active()){abort.abort();host.replaceChildren();clearInterval(timer)}};window.addEventListener('alkhizana:account-changed',changed);scope.add(()=>window.removeEventListener('alkhizana:account-changed',changed))
 void load();return host
}

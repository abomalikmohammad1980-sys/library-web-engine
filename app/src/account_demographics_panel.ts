import {h} from './ui'
import {currentAccountClaims} from './account_authority'
import {captureRouteResourceScope} from './resource_lifecycle'
export function accountDemographicsPanel():HTMLElement{
 const claims=currentAccountClaims(),scope=captureRouteResourceScope(),abort=new AbortController();scope.add(()=>abort.abort())
 const active=()=>!scope.disposed&&claims?.subject===currentAccountClaims()?.subject&&claims?.sessionId===currentAccountClaims()?.sessionId
 const year=h('input',{type:'number',class:'account-profile__input','aria-label':'سنة الميلاد الميلادية الاختيارية'}) as HTMLInputElement;year.min=String(new Date().getFullYear()-120);year.max=String(new Date().getFullYear())
 const consent=h('input',{type:'checkbox','aria-label':'الموافقة على إحصاءات العمر الإجمالية'}) as HTMLInputElement
 year.disabled=true
 const status=h('p',{role:'status'}),save=h('button',{type:'button',class:'btn btn--secondary',disabled:true},'حفظ اختيار إحصاءات العمر')
 const host=h('section',{class:'account-demographics'},h('h3',null,'المشاركة الاختيارية في إحصاءات الجمهور'),h('label',{class:'account-profile__field'},'سنة الميلاد الميلادية (اختيارية)',year),h('label',null,consent,' أوافق على استخدام سنة ميلادي في إحصاءات عمر إجمالية لتحسين محتوى الخزانة والتعريف بها.'),h('p',{class:'account-profile__hint'},'لا تظهر سنة ميلادك في صفحات الحسابات أو التقارير الإدارية. يمكنك إلغاء الموافقة ثم الحفظ لحذف السنة من بيانات الإحصاء. المشاركة ليست شرطًا لاستخدام الموقع.'),save,status)
 let revision=0
 const send=async(body?:object)=>{
  const response=await fetch('/api/account/demographics',{method:body?'PATCH':'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(8000)]),headers:{'content-type':'application/json','x-alkhizana-request':'account-ui'},...(body?{body:JSON.stringify(body)}:{})})
  if(!response.ok)throw Error(response.status===409?'conflict':'unavailable')
  const reader=response.body?.getReader();if(!reader)throw Error('invalid')
  let text='',size=0;const decoder=new TextDecoder()
  try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>2048)throw Error('invalid');text+=decoder.decode(p.value,{stream:true})}}finally{await reader.cancel().catch(()=>{})}
  const data=JSON.parse(text+decoder.decode()),row=data.demographics
  if(!row||!Number.isSafeInteger(row.revision)||row.revision<0||typeof row.consent!=='boolean'||!(row.birthYear===null||Number.isSafeInteger(row.birthYear)))throw Error('invalid')
  if(row.consent?(row.birthYear===null||row.birthYear<new Date().getUTCFullYear()-120||row.birthYear>new Date().getUTCFullYear()):row.birthYear!==null)throw Error('invalid')
  if(!active())throw Error('identity');revision=row.revision;consent.checked=row.consent;year.value=row.birthYear===null?'':String(row.birthYear);year.disabled=!consent.checked
 }
 consent.onchange=()=>{year.disabled=!consent.checked}
 save.onclick=async()=>{if(!active()||save.disabled)return;if(consent.checked&&(!year.value||!year.checkValidity())){status.textContent='أدخل سنة ميلاد صحيحة أو ألغِ الموافقة.';return}save.disabled=true
  try{await send({birthYear:consent.checked?Number(year.value):null,consent:consent.checked,expectedVersion:revision});status.textContent=consent.checked?'حُفظت موافقتك الاختيارية.':'أُلغيت الموافقة وحُذفت سنة الميلاد من بيانات الإحصاء.'}
  catch(error){if(active())status.textContent=error instanceof Error&&error.message==='conflict'?'تغير اختيارك في جلسة أخرى؛ أعد فتح الصفحة قبل الحفظ.':'تعذّر الحفظ. لم نؤكد تغيير اختيارك.'}finally{if(active())save.disabled=false}}
 const changed=()=>{if(!active()){abort.abort();host.replaceChildren()}};window.addEventListener('alkhizana:account-changed',changed);scope.add(()=>window.removeEventListener('alkhizana:account-changed',changed))
 void send().then(()=>{if(active())save.disabled=false}).catch(()=>{if(active())status.textContent='إعداد إحصاءات العمر غير متاح الآن.'})
 return host
}

import {currentAccountClaims,hasAccountPermission} from './account_authority'
import {h} from './ui'

type BlockState={subject:string;blocked:boolean;reason:string;version:number;canChange:boolean;events:{blocked:boolean;reason:string;actorName:string;createdAt:string}[]}
export async function requestState(subject:string,input?:{blocked:boolean;reason:string;version:number}):Promise<BlockState>{
  if(!hasAccountPermission(currentAccountClaims(),'book:review-submissions'))throw Error('ليست لديك صلاحية إدارة الحسابات.')
  const actor=currentAccountClaims()!
  const checkSession=()=>{const now=currentAccountClaims();if(now?.subject!==actor.subject||now?.sessionId!==actor.sessionId||now?.role!==actor.role)throw Error('تغيّرت جلسة الحساب؛ افتح الإدارة مجددًا.')}
  let response:Response|undefined
  for(let attempt=0;attempt<(input?1:2);attempt++){
    checkSession()
    try{response=await fetch(`/api/admin/accounts/${encodeURIComponent(subject)}/block`,{method:input?'PATCH':'GET',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000),...(input?{headers:{'content-type':'application/json','x-alkhizana-request':'account-ui'},body:JSON.stringify(input)}:{})})}
    catch{checkSession();if(!input&&attempt===0)continue;throw Error(input?'تعذّر تأكيد حفظ القرار؛ تحقق من حالة الحساب قبل إعادة المحاولة.':'تعذّر تحميل حالة الحساب الآن؛ تحقق من الاتصال ثم أعد المحاولة.')}
    checkSession()
    if(!input&&attempt===0&&[502,503,504].includes(response.status)){await response.body?.cancel();continue}
    break
  }
  if(!response)throw Error('تعذّر تحميل حالة الحساب.')
  if(!response.ok){if(response.status===401)throw Error('انتهت جلسة الدخول؛ سجّل الدخول مجددًا.');if(response.status===404)throw Error('لم يعد الحساب موجودًا؛ حدّث قائمة الحسابات.');if(response.status===429)throw Error('طلبات كثيرة؛ انتظر قليلًا ثم أعد المحاولة.');if(response.status===409)throw Error('غيّر مدير آخر حالة الحساب؛ أغلق الإدارة وافتحها مجددًا لتحديثها.');if(response.status===403)throw Error('لا يمكن إدارة حالة هذا الحساب بهذه الصلاحية.');throw Error(input?'تعذّر تأكيد حفظ القرار؛ تحقق من حالة الحساب قبل إعادة المحاولة.':'خدمة إدارة الحساب غير متاحة مؤقتًا؛ أعد المحاولة.')}
  const state=await response.json() as BlockState
  checkSession()
  if(state.subject!==subject||typeof state.blocked!=='boolean'||!Number.isSafeInteger(state.version)||state.version<0||typeof state.reason!=='string'||(!input&&(typeof state.canChange!=='boolean'||!Array.isArray(state.events))))throw Error('تعذّر التحقق من رد إدارة الحساب.')
  return state
}
/** Load on demand rather than issuing a request for every account in the list. */
export function accountBlockControls(subject:string):HTMLElement{
  const toggle=h('button',{class:'btn btn--secondary',type:'button','aria-expanded':'false',title:'عرض نشاط الحساب وحظره أو رفع الحظر'},'حالة الحساب والحظر') as HTMLButtonElement
  const body=h('div',{'aria-live':'polite'}),host=h('div',null,toggle,body)
  toggle.onclick=async()=>{
    if(toggle.getAttribute('aria-expanded')==='true'){body.replaceChildren();toggle.setAttribute('aria-expanded','false');return}
    toggle.disabled=true
    body.textContent='جارٍ تحميل حالة الحساب…'
    try{const state=await requestState(subject);toggle.setAttribute('aria-expanded','true');render(state)}catch(error){body.textContent=error instanceof Error?error.message:'تعذّر تحميل حالة الحساب.'}finally{toggle.disabled=false}
  }
  function render(state:BlockState){
    const status=h('p',{role:'status'},state.blocked?'الحساب محظور':'الحساب نشط')
    const reason=h('input',{'aria-label':'سبب حظر الحساب أو رفع الحظر',placeholder:'سبب القرار',maxlength:1000}) as HTMLInputElement
    const save=h('button',{class:'btn btn--secondary',type:'button'},state.blocked?'رفع حظر الحساب':'حظر الحساب') as HTMLButtonElement
    save.disabled=!state.canChange
    save.onclick=async()=>{if(!reason.value.trim()){status.textContent='اكتب سبب القرار أولًا.';reason.focus();return}save.disabled=true;try{const changed=await requestState(subject,{blocked:!state.blocked,reason:reason.value.trim(),version:state.version});render({...state,...changed,events:[{blocked:changed.blocked,reason:changed.reason,actorName:currentAccountClaims()?.displayName??'المدير',createdAt:new Date().toISOString()},...state.events].slice(0,20)})}catch(error){status.textContent=error instanceof Error?error.message:'تعذّر حفظ القرار.';save.disabled=false}}
    body.replaceChildren(status,...(!state.canChange?[h('p',null,'حسابات الإدارة محمية من الحظر هنا.')]:[h('p',null,'الحظر يوقف دخول الحساب وجلساته، ويحافظ على كتبه.'),reason,save]),...state.events.map(event=>h('p',null,h('strong',null,event.blocked?'حظر':'رفع حظر'),' · ',h('span',{dataset:{noTranslate:''}},`${event.actorName}: ${event.reason} (${new Date(event.createdAt).toLocaleString('ar')})`))))
  }
  return host
}

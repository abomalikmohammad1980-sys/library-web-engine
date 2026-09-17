import {h} from './ui'
import {accountDemographicsPanel} from './account_demographics_panel'
import {currentAccountClaims} from './account_authority'
import {cloudflareAccessAuthProvider} from './account_service'
import {captureRouteResourceScope} from './resource_lifecycle'
interface Profile {displayName:string;username:string|null;revision:number}
async function profileRequest(signal:AbortSignal,draft?:{displayName:string;username:string;expectedVersion:number}):Promise<Profile>{
 const response=await fetch('/api/account/profile',{method:draft?'PATCH':'GET',credentials:'same-origin',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(8000)]),headers:{'content-type':'application/json','x-alkhizana-request':'account-ui'},...(draft?{body:JSON.stringify(draft)}:{})})
 if(!response.body)throw Error('profile_unavailable')
 const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)throw Error('profile_unavailable');parts.push(value)}}catch(e){await reader.cancel();throw e}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
 const body=JSON.parse(new TextDecoder().decode(bytes)) as {error?:string;profile?:Profile}
 if(!response.ok)throw Error(body.error||'profile_unavailable')
 const p=body.profile;if(!p||typeof p.displayName!=='string'||p.displayName.length>120||!(p.username===null||typeof p.username==='string'&&/^[a-z][a-z0-9_]{2,29}$/.test(p.username))||!Number.isSafeInteger(p.revision)||p.revision<0)throw Error('profile_unavailable')
 signal.throwIfAborted();return p
}
export function accountProfilePanel():HTMLElement{
 const claims=currentAccountClaims(),scope=captureRouteResourceScope(),abort=new AbortController()
 scope.add(()=>abort.abort())
 const current=()=>!scope.disposed&&!abort.signal.aborted&&!!claims&&currentAccountClaims()?.subject===claims.subject&&currentAccountClaims()?.sessionId===claims.sessionId
 const name=h('input',{type:'text',class:'account-profile__input'}) as HTMLInputElement;name.required=true;name.maxLength=120;name.autocomplete='name'
 const username=h('input',{type:'text',class:'account-profile__input'}) as HTMLInputElement;username.maxLength=30;username.pattern='[a-zA-Z][a-zA-Z0-9_]{2,29}';username.dir='ltr';username.autocomplete='off'
 const status=h('p',{role:'status'},'جارٍ تحميل بيانات الحساب…'),save=h('button',{type:'submit',class:'btn btn--primary',disabled:true},'حفظ الاسم')
 const form=h('form',{class:'account-profile'},h('h3',null,'الاسم الظاهر واسم المستخدم'),h('label',{class:'account-profile__field'},h('span',null,'الاسم الظاهر'),name),h('label',{class:'account-profile__field'},h('span',null,'اسم المستخدم (اختياري)'),username),h('p',{class:'account-profile__hint'},'اسم المستخدم من 3 إلى 30 حرفًا لاتينيًا أو رقمًا أو شرطة سفلية، ويبدأ بحرف. لا يغيّر البريد أو طريقة الدخول.'),save,status) as HTMLFormElement
 const changed=()=>{if(!current()){abort.abort();form.replaceChildren(h('p',null,'تغيّر الحساب. أعد فتح صفحة الحساب.'))}}
 window.addEventListener('alkhizana:account-changed',changed);scope.add(()=>window.removeEventListener('alkhizana:account-changed',changed))
 let revision:number|undefined
 if(claims)void profileRequest(abort.signal).then(p=>{if(!current())return;revision=p.revision;name.value=p.displayName;username.value=p.username??'';save.disabled=false;status.textContent=''}).catch(()=>{if(current())status.textContent='تعذّر تحميل بيانات الحساب. لم تتغير بياناتك؛ أعد فتح الصفحة للمحاولة.'})
 form.onsubmit=async event=>{event.preventDefault();if(!current()||save.disabled||revision===undefined)return;save.disabled=true
  try{const p=await profileRequest(abort.signal,{displayName:name.value,username:username.value,expectedVersion:revision});if(!current())return;revision=p.revision;name.value=p.displayName;username.value=p.username??'';status.textContent='حُفظ الاسم في حسابك.';await cloudflareAccessAuthProvider.currentSession()}
  catch(error){if(!current())return;const code=error instanceof Error?error.message:'';status.textContent=code==='username_unavailable'?'اسم المستخدم مستخدم بالفعل؛ اختر اسمًا آخر.':code==='profile_conflict'?'تغيّرت بيانات الحساب في جلسة أخرى. احتفظ بتعديلاتك وأعد فتح الصفحة قبل الحفظ.':code==='invalid_profile'?'تحقق من الاسم واسم المستخدم؛ بعض الأسماء الإدارية محجوزة.':'تعذّر تأكيد الحفظ؛ تحقق من بياناتك قبل إعادة المحاولة.'}
  finally{if(current())save.disabled=false}
 }
 form.append(accountDemographicsPanel())
 return form
}

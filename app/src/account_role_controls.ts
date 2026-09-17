import {currentAccountClaims,type AccountRole} from './account_authority'
import {h} from './ui'
export interface MemberRoleState {accountId:string;role?:AccountRole;roleVersion?:number;canManageRoles?:boolean}
export function canManageMemberRole(member:MemberRoleState):boolean {
 const claims=currentAccountClaims()
 return claims?.role==='super-admin'&&claims.subject!==member.accountId&&member.canManageRoles===true
  &&(member.role==='user'||member.role==='admin'||member.role==='editor')&&Number.isSafeInteger(member.roleVersion)&&Number(member.roleVersion)>=0
}
export async function changeMemberRole(member:MemberRoleState,role:'user'|'admin'|'editor',reason:string):Promise<MemberRoleState>{
 if(!canManageMemberRole(member)||!['user','admin','editor'].includes(role)||!reason.trim()||reason.trim().length>1000)throw Error('لا يمكن تنفيذ تغيير الصلاحية بهذه البيانات.')
 const identity=currentAccountClaims()!
 const response=await fetch(`/api/admin/accounts/${encodeURIComponent(member.accountId)}/role`,{method:'PATCH',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json','x-alkhizana-request':'account-ui'},body:JSON.stringify({role,expectedVersion:member.roleVersion,reason:reason.trim()})})
 if(response.status===409)throw Error('تغيّرت صلاحية الحساب؛ حدّث الصفحة قبل إعادة المحاولة.')
 if(!response.ok)throw Error('لم يُحفظ تغيير الصلاحية. تحقق من صلاحيتك ثم حدّث الصفحة.')
 const value=await response.json() as MemberRoleState
 const active=currentAccountClaims()
 if(active?.subject!==identity.subject||active.sessionId!==identity.sessionId||active.role!=='super-admin')throw Error('تغيّرت جلسة الحساب؛ لم تُعرض بيانات العملية.')
 if(value.accountId!==member.accountId||value.role!==role||value.roleVersion!==Number(member.roleVersion)+1||typeof value.canManageRoles!=='boolean')throw Error('تعذّر التحقق من نتيجة تغيير الصلاحية.')
 return value
}
export function accountRoleControls(member:MemberRoleState):HTMLElement{
 const host=h('div',{'aria-live':'polite'})
 if(!canManageMemberRole(member))return host
 const select=h('select',{'aria-label':'صلاحية الحساب'},h('option',{value:'user'},'مستخدم'),h('option',{value:'admin'},'مدير مراجعة الكتب'),h('option',{value:'editor'},'مشرف إضافة وتحرير')) as HTMLSelectElement
 select.value=member.role!
 const reason=h('input',{'aria-label':'سبب تغيير الصلاحية',placeholder:'سبب تغيير الصلاحية',maxlength:1000}) as HTMLInputElement
 const save=h('button',{type:'button',class:'btn btn--secondary'},'حفظ صلاحية الحساب') as HTMLButtonElement
 const status=h('p',{role:'status'})
 save.onclick=async()=>{save.disabled=true;try{const next=await changeMemberRole(member,select.value as 'user'|'admin'|'editor',reason.value);Object.assign(member,next);status.textContent='حُفظت صلاحية الحساب.';reason.value=''}catch(error){status.textContent=error instanceof Error?error.message:'تعذّر حفظ الصلاحية.'}finally{save.disabled=!canManageMemberRole(member)}}
 host.append(h('p',null,'مدير المراجعة يراجع كتب المستخدمين وينشر المقبول منها. مشرف الإضافة والتحرير يضيف ويعدّل الكتب والتراجم والتصنيفات العامة دون حذف أو ترقية حسابات.'),select,reason,save,status)
 return host
}

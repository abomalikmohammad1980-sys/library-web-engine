import {currentAccountClaims,currentAccountAuthorityRevision,installTrustedRuntimeClaims,isTrustedAccountClaims,requireAccountPermission,type AccountClaims,type AuthProvider,type SignInResult} from './account_authority'
import {appendSubmissionReviewAuditEvent} from './admin_audit'
import {accountEntryReturn} from './account_entry'

const ACCOUNT_NATIVE_SESSION='/api/account/native-session'
const ACCOUNT_READINESS='/api/account/readiness'
export interface AccountReadiness {ready:boolean;access:{configured:boolean;missing?:string[];bridgeReady?:boolean};native?:{configured:boolean};bindings?:{visitorsDb:boolean;libraryR2:boolean}}
const ACCOUNT_ERROR_ARABIC:Record<string,string>={
  account_owner_invalid:'تعذّر تحديد صاحب الحساب. حدّث قائمة الحسابات ثم أعد المحاولة.',account_members_page_invalid:'رقم صفحة الحسابات أو حجمها غير صالح. حدّث القائمة.',account_blocked:'أوقفت الإدارة هذا الحساب. تواصل معها لمراجعة حالته.',
  device_limit_reached:'بلغ حسابك ثلاثة أجهزة. ألغِ جهازًا قديمًا من جهاز مسجل أو تواصل مع الإدارة.',device_revoked:'أُلغي تسجيل هذا الجهاز. سجّل الدخول من جهاز معتمد أو تواصل مع الإدارة.',
  account_session_required:'يلزم تسجيل الدخول لإتمام هذا الإجراء.',account_session_invalid:'تعذّر التحقق من جلسة الحساب. سجّل الدخول من جديد.',account_permission_denied:'ليست لديك صلاحية تنفيذ هذا الإجراء.',account_auth_not_ready:'خدمة تسجيل الدخول غير جاهزة الآن.',
  account_service_unavailable:'تعذّر الاتصال بخدمة الحسابات الآن. أعد المحاولة.',account_response_invalid:'وصل رد غير صالح من خدمة الحسابات. لم تُغيّر بياناتك.',
  account_book_type_rejected:'صيغة هذا الملف غير مدعومة.',account_book_empty:'الملف فارغ.',account_book_too_large:'حجم الكتاب أكبر من الحد المسموح.',
  account_book_title_invalid:'أدخل عنوانًا صالحًا للكتاب.',account_book_author_invalid:'أدخل اسم مؤلف صالحًا.',account_book_category_invalid:'اسم التصنيف أطول من الحد المسموح.',
  account_book_id_invalid:'معرّف الكتاب غير صالح.',account_books_page_invalid:'رقم صفحة كتب الحساب أو حجمها غير صالح.',account_review_decision_invalid:'قرار المراجعة غير صالح.',account_review_note_invalid:'ملاحظة المراجعة أطول من الحد المسموح.',
  account_storage_quota_exceeded:'بلغ حسابك الحد المسموح للكتب أو مساحة التخزين.',
  account_review_version_invalid:'نسخة سجل المراجعة غير صالحة؛ حدّث القائمة.',account_review_status_invalid:'مرشح حالة المراجعة غير صالح.',account_review_page_invalid:'رقم صفحة مراجعة الكتب أو حجمها غير صالح.',account_audit_page_invalid:'رقم صفحة سجل الإدارة أو حجمها غير صالح.',account_review_conflict:'غيّر مدير آخر هذا الكتاب؛ حدّث البيانات ثم أعد المحاولة.',account_central_version_invalid:'نسخة الكتاب المركزي غير صالحة؛ حدّث القائمة.',account_central_conflict:'غيّر مدير آخر هذا الكتاب؛ بقيت تعديلاتك في الحقول. راجع النسخة الأحدث ثم أعد المحاولة.',published_book_must_be_withdrawn:'الكتاب منشور للعامة؛ اسحب نشره إداريًا قبل حذفه من الحساب.',account_book_deletion_pending:'أُخفي الكتاب من حسابك، وتعذر تنظيف ملفه الآن. أعد الحذف لاحقًا لإكمال التنظيف.',
}
export function accountErrorArabic(error:unknown,fallback='تعذّر تنفيذ الإجراء الآن.'):string{return error instanceof Error?ACCOUNT_ERROR_ARABIC[error.message]??fallback:fallback}
async function session():Promise<AccountClaims|null>{
  const revision=currentAccountAuthorityRevision()
  try{
    const response=await fetch(ACCOUNT_NATIVE_SESSION,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(10_000)})
    if(!response.ok&&revision!==currentAccountAuthorityRevision())throw new Error('account_session_invalid')
    if(response.status===401){installTrustedRuntimeClaims(null);return null}
    if(!response.ok){const payload=await response.json().catch(()=>null);throw new Error(payload?.error==='device_limit_reached'||payload?.error==='device_revoked'||payload?.error==='account_blocked'?payload.error:'account_service_unavailable')}
    const claims=(await response.json() as {claims?:unknown}).claims
    if(!isTrustedAccountClaims(claims))throw new Error('account_session_invalid')
    if(revision!==currentAccountAuthorityRevision()){
      const active=currentAccountClaims()
      // Concurrent probes may confirm the identity already installed by a newer
      // probe. Reuse it without installing the old response or emitting an event.
      if(active&&active.subject===claims.subject&&active.sessionId===claims.sessionId&&active.role===claims.role&&active.displayName===claims.displayName)return active
      throw new Error('account_session_invalid')
    }
    installTrustedRuntimeClaims(claims);return claims
  }catch(error){if(revision===currentAccountAuthorityRevision())installTrustedRuntimeClaims(null);throw error}
}
function validAccountReadiness(value:unknown):value is AccountReadiness{
  if(!value||typeof value!=='object')return false
  const item=value as Partial<AccountReadiness>
  return typeof item.ready==='boolean'&&Boolean(item.access)&&typeof item.access?.configured==='boolean'
    &&(item.access.missing===undefined||(Array.isArray(item.access.missing)&&item.access.missing.every(name=>typeof name==='string')))
    &&(item.bindings===undefined||(typeof item.bindings?.visitorsDb==='boolean'&&typeof item.bindings?.libraryR2==='boolean'))
    &&(item.access.bridgeReady===undefined||typeof item.access.bridgeReady==='boolean')
    &&(item.native===undefined||typeof item.native?.configured==='boolean')
}
export async function loadAccountReadiness():Promise<AccountReadiness>{
  const response=await fetch(ACCOUNT_READINESS,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(10_000)})
  if(response.status!==200&&response.status!==503)throw new Error('account_service_unavailable')
  let payload:unknown
  try{payload=await response.json()}catch{throw new Error('account_service_unavailable')}
  if(!validAccountReadiness(payload))throw new Error('account_response_invalid')
  if(payload.ready!==response.ok)throw new Error('account_response_invalid')
  return payload
}
export function accountReadinessArabic(readiness:AccountReadiness):string{
  if(readiness.ready)return'منظومة الحسابات جاهزة.'
  return 'منظومة الحسابات غير جاهزة الآن.'
}
export const cloudflareAccessAuthProvider:AuthProvider={
  state:'ready',currentSession:session,
  async signIn():Promise<SignInResult>{const claims=await session();if(claims)return{kind:'authenticated',claims};const readiness=await loadAccountReadiness();if(!readiness.ready||!readiness.access.bridgeReady)throw new Error('account_auth_not_ready');const returnTo=legacyHashToPath(accountEntryReturn(routeLocation.hash)??routeLocation.hash);location.assign(`/api/account/access-start?returnTo=${encodeURIComponent(returnTo)}`);return{kind:'not-configured'}},
  async signOut(){installTrustedRuntimeClaims(null);const returnTo=legacyHashToPath(routeLocation.hash);location.assign(`/api/account/logout?returnTo=${encodeURIComponent(returnTo)}`)},
}

export interface AccountBookSubmission {id:string;title:string;author:string;category?:string;mimeType:string;byteLength:number;visibility:'private'|'public';reviewStatus:'pending'|'approved'|'rejected';reviewNote?:string;reviewVersion?:number;createdAt:string;ownerEmail?:string}
export interface AccountAdminStats {accountsTotal:number;booksTotal:number;pending:number;approved:number;rejected:number;publicBooks:number;privateBooks:number;deviceLimitRejections24h?:number}
export interface AccountAdminMember {reportsTotal?:number;accountId:string;displayName:string;email:string;booksTotal:number;pending:number;approved:number;rejected:number;role?:'user'|'admin'|'editor'|'super-admin';roleVersion?:number;canManageRoles?:boolean}
export interface AccountAdminAuditEvent {id:string;kind:'review'|'central';bookId:string;actorName:string;action:'publish'|'private'|'reject'|'update'|'delete'|'restore';createdAt:string}
export const ACCOUNT_BOOK_ACCEPT='.docx,.doc,.rtf,.pdf,.epub,.bok,.txt,.md'
// Keep this boundary identical to the Pages upload function. Rejecting it in
// the browser avoids transferring tens of MiB only to receive a late 400.
export const ACCOUNT_BOOK_MAX_BYTES=64*1024*1024
const ACCOUNT_BOOK_EXTENSIONS=new Set(ACCOUNT_BOOK_ACCEPT.split(','))
function validateAccountBookInput(input:{file:File;title:string;author:string;category?:string}):void{
  const extension=/\.[^.]+$/u.exec(input.file.name.toLocaleLowerCase('en'))?.[0]??''
  if(!ACCOUNT_BOOK_EXTENSIONS.has(extension))throw new Error('account_book_type_rejected')
  if(!Number.isFinite(input.file.size)||input.file.size<=0)throw new Error('account_book_empty')
  if(input.file.size>ACCOUNT_BOOK_MAX_BYTES)throw new Error('account_book_too_large')
  if(!input.title.trim()||input.title.trim().length>300)throw new Error('account_book_title_invalid')
  if(!input.author.trim()||input.author.trim().length>200)throw new Error('account_book_author_invalid')
  if(input.category!==undefined&&input.category.trim().length>120)throw new Error('account_book_category_invalid')
}
async function api<T>(url:string,init?:RequestInit):Promise<T>{
  const mutating=Boolean(init?.method&&init.method.toUpperCase()!=='GET'&&init.method.toUpperCase()!=='HEAD')
  const response=await fetch(url,{...init,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...init?.headers,...(mutating?{'x-alkhizana-request':'account-ui'}:{})}})
  if(!response.ok){
    if(response.status===401||response.status===403)installTrustedRuntimeClaims(null)
    if(response.status===401)throw new Error('account_session_required')
    if(response.status===403)throw new Error('account_permission_denied')
    if(response.status===413)throw new Error('account_book_too_large')
    if(response.status===415)throw new Error('account_book_type_rejected')
    if(response.status===409){const payload=await response.json().catch(()=>null),code=payload&&typeof payload==='object'?(payload as {error?:unknown}).error:undefined;throw new Error(code==='account_storage_quota_exceeded'?'account_storage_quota_exceeded':code==='central_book_conflict'?'account_central_conflict':code==='published_book_must_be_withdrawn'?'published_book_must_be_withdrawn':'account_review_conflict')}
    if(response.status===503){const payload=await response.json().catch(()=>null);if(payload&&typeof payload==='object'&&(payload as {error?:unknown}).error==='account_book_deletion_pending')throw new Error('account_book_deletion_pending')}
    throw new Error('account_service_unavailable')
  }
  return response.json()
}
function requireAuthenticatedAccount():AccountClaims{const claims=currentAccountClaims();if(!claims)throw new Error('account_session_required');return claims}
export const updateAccountBook=async(id:string,changes:{title:string;author:string;category:string;reviewVersion:number})=>{
  requireAuthenticatedAccount()
  const result=await api<{id:string;reviewVersion:number}>(`/api/account/books/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(changes)})
  if(result?.id!==id||result.reviewVersion!==changes.reviewVersion+1)throw new Error('account_response_invalid')
  return result
}
function parseSubmission(value:unknown,includeOwnerEmail:boolean):AccountBookSubmission|null{
  if(!value||typeof value!=='object')return null
  const item=value as Partial<AccountBookSubmission>
  if(typeof item.id!=='string'||!item.id||item.id.length>200||item.id!==item.id.trim()||typeof item.title!=='string'||!item.title.trim()||item.title.length>300||typeof item.author!=='string'||!item.author.trim()||item.author.length>200||typeof item.mimeType!=='string'||!item.mimeType
    ||typeof item.byteLength!=='number'||!Number.isFinite(item.byteLength)||item.byteLength<0
    ||(item.visibility!=='private'&&item.visibility!=='public')
    ||(item.reviewStatus!=='pending'&&item.reviewStatus!=='approved'&&item.reviewStatus!=='rejected')
    ||typeof item.createdAt!=='string'||!Number.isFinite(Date.parse(item.createdAt))
    ||(item.category!==undefined&&typeof item.category!=='string')||(item.reviewNote!==undefined&&typeof item.reviewNote!=='string')
    ||(item.reviewVersion!==undefined&&(!Number.isSafeInteger(item.reviewVersion)||item.reviewVersion<0))
    ||(includeOwnerEmail&&item.ownerEmail!==undefined&&typeof item.ownerEmail!=='string'))return null
  return {id:item.id,title:item.title,author:item.author,mimeType:item.mimeType,byteLength:item.byteLength,visibility:item.visibility,reviewStatus:item.reviewStatus,createdAt:item.createdAt,
    ...(item.category!==undefined?{category:item.category}:{}),...(item.reviewNote!==undefined?{reviewNote:item.reviewNote}:{}),...(item.reviewVersion!==undefined?{reviewVersion:item.reviewVersion}:{}),...(includeOwnerEmail&&item.ownerEmail!==undefined?{ownerEmail:item.ownerEmail}:{})}
}
function parseSubmissionList(value:unknown,key:'books'|'submissions',includeOwnerEmail:boolean):AccountBookSubmission[]{
  if(!value||typeof value!=='object'||!Array.isArray((value as Record<string,unknown>)[key]))throw new Error('account_response_invalid')
  const parsed=(value as Record<string,unknown>)[key] as unknown[],books=parsed.map(item=>parseSubmission(item,includeOwnerEmail))
  if(books.some(item=>item===null))throw new Error('account_response_invalid')
  return books as AccountBookSubmission[]
}
export const listAccountBooksPage=async(page=0,limit=50)=>{requireAuthenticatedAccount();if(!Number.isSafeInteger(page)||page<0||page>10_000||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('account_books_page_invalid');const payload=await api<unknown>(`/api/account/books?page=${page}&limit=${limit}`);if(!payload||typeof payload!=='object')throw new Error('account_response_invalid');const value=payload as {page?:unknown;hasMore?:unknown};if(value.page!==page||typeof value.hasMore!=='boolean')throw new Error('account_response_invalid');const books=parseSubmissionList(payload,'books',false);if(books.length>limit||(value.hasMore&&books.length===0)||new Set(books.map(item=>item.id)).size!==books.length)throw new Error('account_response_invalid');return{books,page,hasMore:value.hasMore}}
export const listAccountBooks=async()=>{const books:AccountBookSubmission[]=[],seen=new Set<string>();for(let page=0;page<=10_000;page++){const result=await listAccountBooksPage(page,50);for(const book of result.books){if(seen.has(book.id))throw new Error('account_response_invalid');seen.add(book.id);books.push(book)}if(!result.hasMore)return books}throw new Error('account_response_invalid')}
export const submitAccountBook=async(input:import('./central_book_upload').CentralBookUploadInput)=>{requireAuthenticatedAccount();validateAccountBookInput(input);const body=new FormData();body.set('file',input.file);body.set('title',input.title.trim());body.set('author',input.author.trim());if(input.category?.trim())body.set('category',input.category.trim());appendWordBundle(body,input);const result=await api<unknown>('/api/account/books',{method:'POST',body});const row=result&&typeof result==='object'?result as {id?:unknown;visibility?:unknown;reviewStatus?:unknown}:null;const id=row?.id;if(typeof id!=='string'||!id||id.length>200||id!==id.trim()||!['private','public'].includes(String(row?.visibility))||!['pending','approved','rejected'].includes(String(row?.reviewStatus))||(row?.visibility==='public'&&row?.reviewStatus!=='approved'))throw new Error('account_response_invalid');return result as{id:string;visibility:'private'|'public';reviewStatus:'pending'|'approved'|'rejected'}}
export const submitCentralBookCandidate=async(input:{file:File;title:string;author:string;category?:string})=>{requireAccountPermission(currentAccountClaims(),'book:review-submissions');return submitAccountBook(input)}
export const createCentralBook=async(input:import('./central_book_upload').CentralBookUploadInput)=>{
 const identity=currentAccountClaims();if(identity?.role!=='editor'&&identity?.role!=='super-admin')throw Error('account_permission_denied')
 validateAccountBookInput(input)
 const body=new FormData();body.set('file',input.file);body.set('title',input.title.trim());body.set('author',input.author.trim());if(input.category?.trim())body.set('category',input.category.trim())
 const files=[input.file,...(input.volumeFiles??[]),...(input.pdfFile?[input.pdfFile]:[]),...(input.coverFile?[input.coverFile]:[]),...(input.wordMapFile?[input.wordMapFile]:[])]
 if((input.volumeFiles?.length??0)>20||files.reduce((sum,file)=>sum+file.size,0)>64*1024*1024)throw Error('account_book_file_invalid')
 if(input.metadata)body.set('metadata',JSON.stringify(input.metadata))
 input.volumeFiles?.forEach((file,index)=>body.set(`volumeFile:${index+1}`,file))
 if(input.pdfFile)body.set('pdfFile',input.pdfFile)
 if(input.coverFile)body.set('coverFile',input.coverFile)
 appendWordBundle(body,input)
 const value=await api<unknown>('/api/admin/library-books',{method:'POST',body})
 const active=currentAccountClaims();if(active?.subject!==identity.subject||active.sessionId!==identity.sessionId)throw Error('account_session_invalid')
 if(!value||typeof value!=='object')throw Error('account_response_invalid')
 const row=value as {id?:unknown;visibility?:unknown;reviewStatus?:unknown;reviewVersion?:unknown}
 if(typeof row.id!=='string'||!row.id.trim()||row.id!==row.id.trim()||row.id.length>200||row.visibility!=='public'||row.reviewStatus!=='approved'||!Number.isSafeInteger(row.reviewVersion)||Number(row.reviewVersion)<1)throw Error('account_response_invalid')
 return row as {id:string;visibility:'public';reviewStatus:'approved';reviewVersion:number}
}
function appendWordBundle(body:FormData,input:import('./central_book_upload').CentralBookUploadInput):void{
 if(input.metadata)body.set('metadata',JSON.stringify(input.metadata))
 input.volumeFiles?.forEach((file,index)=>body.set(`volumeFile:${index+1}`,file))
 if(input.coverFile)body.set('coverFile',input.coverFile)
 if(input.pdfFile)body.set('pdfFile',input.pdfFile)
 if(!input.wordBundle&&!input.wordMapFile)return
 if(!input.wordBundle||!input.wordMapFile||!input.pdfFile||input.volumeFiles?.length||input.file.size+input.pdfFile.size+input.wordMapFile.size+(input.coverFile?.size??0)>64*1024*1024)throw Error('invalid_word_bundle')
 body.set('pdfFile',input.pdfFile);body.set('wordMapFile',input.wordMapFile);body.set('wordBundle',JSON.stringify(input.wordBundle))
 if(input.metadata)body.set('metadata',JSON.stringify(input.metadata))
}
export const accountBookReviewFilePath=(id:string):string=>{requireAccountPermission(currentAccountClaims(),'book:review-submissions');const cleanId=id.trim();if(!cleanId||cleanId.length>200||cleanId!==id)throw new Error('account_book_id_invalid');return `/api/account/books/${encodeURIComponent(cleanId)}/file`}
export const deleteAccountBook=async(id:string)=>{requireAuthenticatedAccount();const cleanId=id.trim();if(!cleanId||cleanId.length>200)throw new Error('account_book_id_invalid');const result=await api<unknown>(`/api/account/books/${encodeURIComponent(cleanId)}`,{method:'DELETE'});if(!result||typeof result!=='object'||(result as {id?:unknown}).id!==cleanId||(result as {deleted?:unknown}).deleted!==true)throw new Error('account_response_invalid');return result as{id:string;deleted:true}}
export type AccountReviewStatusFilter='all'|'pending'|'approved'|'rejected'
export const listBookSubmissionsPage=async(status:AccountReviewStatusFilter='pending',page=0,limit=50,owner='',excludeSelf=false)=>{requireAccountPermission(currentAccountClaims(),'book:review-submissions');if(!['all','pending','approved','rejected'].includes(status))throw new Error('account_review_status_invalid');if(!Number.isSafeInteger(page)||page<0||page>10_000||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('account_review_page_invalid');if(owner.length>200||owner!==owner.trim())throw new Error('account_owner_invalid');const payload=await api<unknown>(`/api/admin/book-submissions?status=${status}&page=${page}&limit=${limit}${owner?`&owner=${encodeURIComponent(owner)}`:''}${excludeSelf?'&excludeSelf=1':''}`);if(!payload||typeof payload!=='object')throw new Error('account_response_invalid');const value=payload as {submissions?:unknown;page?:unknown;hasMore?:unknown};if(value.page!==page||typeof value.hasMore!=='boolean')throw new Error('account_response_invalid');const submissions=parseSubmissionList(payload,'submissions',true);if(submissions.length>limit||(value.hasMore&&submissions.length===0)||(status!=='all'&&submissions.some(item=>item.reviewStatus!==status))||new Set(submissions.map(item=>item.id)).size!==submissions.length)throw new Error('account_response_invalid');return{submissions,page,hasMore:value.hasMore}}
export const listBookSubmissions=async(status:AccountReviewStatusFilter='pending')=>{const submissions:AccountBookSubmission[]=[],seen=new Set<string>();for(let page=0;page<=10_000;page++){const result=await listBookSubmissionsPage(status,page,50);for(const book of result.submissions){if(seen.has(book.id))throw new Error('account_response_invalid');seen.add(book.id);submissions.push(book)}if(!result.hasMore)return submissions}throw new Error('account_response_invalid')}
export const loadAccountMemberBooks=async(owner:string):Promise<AccountBookSubmission[]>=>{if(!owner||owner.length>200||owner!==owner.trim())throw new Error('account_owner_invalid');const submissions:AccountBookSubmission[]=[],seen=new Set<string>();for(let page=0;page<=10_000;page++){const result=await listBookSubmissionsPage('all',page,50,owner);for(const book of result.submissions){if(seen.has(book.id))throw new Error('account_response_invalid');seen.add(book.id);submissions.push(book)}if(!result.hasMore)return submissions}throw new Error('account_response_invalid')}
export const loadAccountAdminStats=async():Promise<AccountAdminStats>=>{requireAccountPermission(currentAccountClaims(),'book:review-submissions');const payload=await api<unknown>('/api/admin/account-stats'),stats=payload&&typeof payload==='object'?(payload as {stats?:unknown}).stats:undefined;if(!stats||typeof stats!=='object')throw new Error('account_response_invalid');const value=stats as Partial<AccountAdminStats>,keys:Array<keyof AccountAdminStats>=['accountsTotal','booksTotal','pending','approved','rejected','publicBooks','privateBooks'];if(keys.some(key=>!Number.isSafeInteger(value[key])||Number(value[key])<0)||(value.deviceLimitRejections24h!==undefined&&(!Number.isSafeInteger(value.deviceLimitRejections24h)||value.deviceLimitRejections24h<0)))throw new Error('account_response_invalid');const valid=value as AccountAdminStats;if(valid.pending+valid.approved+valid.rejected!==valid.booksTotal||valid.publicBooks+valid.privateBooks!==valid.booksTotal)throw new Error('account_response_invalid');return valid}
export const loadAccountAdminMembersPage=async(page=0,limit=100):Promise<{accounts:AccountAdminMember[];page:number;hasMore:boolean;total?:number}>=>{requireAccountPermission(currentAccountClaims(),'book:review-submissions');if(!Number.isSafeInteger(page)||page<0||page>10_000||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('account_members_page_invalid');const payload=await api<unknown>(`/api/admin/account-members?page=${page}&limit=${limit}`);if(!payload||typeof payload!=='object')throw new Error('account_response_invalid');const value=payload as {accounts?:unknown;page?:unknown;hasMore?:unknown;total?:unknown},rows=value.accounts;if(!Array.isArray(rows)||rows.length>limit||value.page!==page||typeof value.hasMore!=='boolean'||(value.hasMore&&rows.length===0))throw new Error('account_response_invalid');const accounts=rows.map(raw=>{if(!raw||typeof raw!=='object')throw new Error('account_response_invalid');const item=raw as Partial<AccountAdminMember>,counts=['booksTotal','pending','approved','rejected'] as const;if(typeof item.accountId!=='string'||!item.accountId||item.accountId.length>200||item.accountId!==item.accountId.trim()||typeof item.displayName!=='string'||!item.displayName.trim()||item.displayName.length>200||typeof item.email!=='string'||!item.email.trim()||item.email.length>320||counts.some(key=>!Number.isSafeInteger(item[key])||Number(item[key])<0)||Number(item.pending)+Number(item.approved)+Number(item.rejected)!==Number(item.booksTotal))throw new Error('account_response_invalid');return item as AccountAdminMember});if(new Set(accounts.map(item=>item.accountId)).size!==accounts.length)throw new Error('account_response_invalid');if(value.total!==undefined&&(!Number.isSafeInteger(value.total)||Number(value.total)<0))throw new Error('account_response_invalid');return{accounts,page,hasMore:value.hasMore,...(typeof value.total==='number'?{total:value.total}:{})}}
export const loadAccountAdminMembers=async():Promise<AccountAdminMember[]>=>{const accounts:AccountAdminMember[]=[],seen=new Set<string>();for(let page=0;page<=10_000;page++){const result=await loadAccountAdminMembersPage(page,100);for(const account of result.accounts){if(seen.has(account.accountId))throw new Error('account_response_invalid');seen.add(account.accountId);accounts.push(account)}if(!result.hasMore)return accounts}throw new Error('account_response_invalid')}
export const loadAccountAdminAudit=async(page=0,limit=50):Promise<{events:AccountAdminAuditEvent[];page:number;hasMore:boolean}>=>{requireAccountPermission(currentAccountClaims(),'book:review-submissions');if(!Number.isSafeInteger(page)||page<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('account_audit_page_invalid');const payload=await api<unknown>(`/api/admin/audit-events?page=${page}&limit=${limit}`);if(!payload||typeof payload!=='object')throw new Error('account_response_invalid');const value=payload as {events?:unknown;page?:unknown;hasMore?:unknown};if(!Array.isArray(value.events)||value.page!==page||typeof value.hasMore!=='boolean')throw new Error('account_response_invalid');const actions=new Set(['publish','private','reject','update','delete','restore']),events=value.events.map(item=>{if(!item||typeof item!=='object')return null;const event=item as Partial<AccountAdminAuditEvent>;return typeof event.id==='string'&&event.id&&(event.kind==='review'||event.kind==='central')&&typeof event.bookId==='string'&&event.bookId&&typeof event.actorName==='string'&&event.actorName&&typeof event.action==='string'&&actions.has(event.action)&&typeof event.createdAt==='string'&&Number.isFinite(Date.parse(event.createdAt))?event as AccountAdminAuditEvent:null});if(events.some(event=>!event))throw new Error('account_response_invalid');const valid=events as AccountAdminAuditEvent[];if(new Set(valid.map(event=>event.id)).size!==valid.length)throw new Error('account_response_invalid');return{events:valid,page,hasMore:value.hasMore}}
export const loadCompleteAccountAdminAudit=async(limit=100):Promise<AccountAdminAuditEvent[]>=>{const events:AccountAdminAuditEvent[]=[],seen=new Set<string>();for(let page=0;page<=10_000;page++){const result=await loadAccountAdminAudit(page,limit);if(result.hasMore&&result.events.length===0)throw new Error('account_response_invalid');for(const event of result.events){if(seen.has(event.id))throw new Error('account_response_invalid');seen.add(event.id);events.push(event)}if(!result.hasMore)return events}throw new Error('account_response_invalid')}
export async function loadCentralBookVersions():Promise<Map<string,number>>{requireAccountPermission(currentAccountClaims(),'book:edit-published-metadata');const payload=await api<unknown>('/api/admin/library-books');if(!payload||typeof payload!=='object'||!Array.isArray((payload as {overrides?:unknown}).overrides))throw new Error('account_response_invalid');const result=new Map<string,number>();for(const raw of (payload as {overrides:unknown[]}).overrides){if(!raw||typeof raw!=='object')throw new Error('account_response_invalid');const item=raw as {bookId?:unknown;revision?:unknown};if(typeof item.bookId!=='string'||!item.bookId||!Number.isSafeInteger(item.revision)||Number(item.revision)<0)throw new Error('account_response_invalid');result.set(item.bookId,Number(item.revision))}return result}
import {rememberCentralMutation} from './central_book_receipt'
export const mutateCentralBook=async(id:string,input:{action:'update'|'delete'|'restore';expectedVersion:number;title?:string;author?:string;category?:string|null;visibility?:'public'|'unlisted'|'hidden';note?:string})=>{const claims=currentAccountClaims();requireAccountPermission(claims,input.action==='delete'?'book:logical-delete-published':'book:edit-published-metadata');const cleanId=id.trim();if(!cleanId||cleanId.length>200)throw new Error('account_book_id_invalid');if(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)throw new Error('account_central_version_invalid');if(input.category!==undefined&&input.category!==null&&input.category.trim().length>120)throw new Error('account_book_category_invalid');const result=await api<unknown>(`/api/admin/library-books/${encodeURIComponent(cleanId)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(input)});if(!result||typeof result!=='object')throw new Error('account_response_invalid');const value=result as {id?:unknown;action?:unknown;visibility?:unknown;logicallyDeleted?:unknown;revision?:unknown;unchanged?:unknown};const expectedDeleted=input.action==='delete',allowedVisibility=value.visibility==='public'||value.visibility==='unlisted'||value.visibility==='hidden';if(value.id!==cleanId||value.action!==input.action||!allowedVisibility||typeof value.logicallyDeleted!=='boolean'||value.logicallyDeleted!==expectedDeleted||!Number.isSafeInteger(value.revision)||(value.unchanged===true?(!expectedDeleted||Number(value.revision)<input.expectedVersion):value.revision!==input.expectedVersion+1)||(expectedDeleted&&value.visibility!=='hidden'))throw new Error('account_response_invalid');rememberCentralMutation(value as {id:string;revision:number;visibility:string;logicallyDeleted:boolean},input);return value as{id:string;action:'update'|'delete'|'restore';visibility:'public'|'unlisted'|'hidden';logicallyDeleted:boolean;revision:number}}
export const decideBookSubmission=async(id:string,decision:'publish'|'private'|'reject',note='',reviewVersion=0,metadata?:{title:string;author:string;category:string})=>{const claims=currentAccountClaims();requireAccountPermission(claims,'book:review-submissions');const cleanId=id.trim(),cleanNote=note.trim();if(!cleanId||cleanId.length>200)throw new Error('account_book_id_invalid');if(!['publish','private','reject'].includes(decision))throw new Error('account_review_decision_invalid');if(cleanNote.length>1000)throw new Error('account_review_note_invalid');if(!Number.isSafeInteger(reviewVersion)||reviewVersion<0)throw new Error('account_review_version_invalid');const result=await api<unknown>(`/api/admin/book-submissions/${encodeURIComponent(cleanId)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({decision,note:cleanNote,reviewVersion,...(metadata?{metadata}: {})})});if(!result||typeof result!=='object'||(result as {id?:unknown}).id!==cleanId)throw new Error('account_response_invalid');const expected=decision==='publish'?{visibility:'public',reviewStatus:'approved'}:decision==='private'?{visibility:'private',reviewStatus:'approved'}:{visibility:'private',reviewStatus:'rejected'};if((result as {visibility?:unknown}).visibility!==expected.visibility||(result as {reviewStatus?:unknown}).reviewStatus!==expected.reviewStatus)throw new Error('account_response_invalid');appendSubmissionReviewAuditEvent(claims!,cleanId,decision);return result as{id:string;visibility:'private'|'public';reviewStatus:'approved'|'rejected'}}
import {routeLocation, legacyHashToPath} from "./path_location"

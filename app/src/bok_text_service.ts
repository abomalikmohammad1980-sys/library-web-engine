import {currentAccountClaims,hasAccountPermission} from './account_authority'
import {validBokTextDraft,type BokTextDraft} from './bok_text_model'
export function captureBokEditorIdentity():()=>boolean{
 const identity=currentAccountClaims(),route=routeLocation.hash
 return()=>{const active=currentAccountClaims();return Boolean(identity&&active&&active.subject===identity.subject&&active.sessionId===identity.sessionId&&active.role===identity.role&&routeLocation.hash===route&&hasAccountPermission(active,'book:edit-published-metadata'))}
}
export async function bokTextDraftRequest(bookId:string,sourceHash:string,pageId:number,current:()=>boolean,input?:{baseHash:string;text:string;expectedRevision:number}):Promise<BokTextDraft|null>{
 if(!current())throw Error('تغيّرت جلسة الإدارة؛ افتح المحرر من جديد.')
 const query=new URLSearchParams({bookId,sourceHash,pageId:String(pageId)})
 const response=await fetch(`/api/admin/bok-text?${query}`,{method:input?'PUT':'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json',...(input?{'content-type':'application/json','x-alkhizana-request':'account-ui'}:{})},...(input?{body:JSON.stringify(input)}:{})})
 if(!current())throw Error('تغيّرت جلسة الإدارة؛ افتح المحرر من جديد.')
 if(response.status===409)throw Error('حفظ مشرف آخر تعديلًا لهذه الصفحة. احتفظ بنصك ثم حمّل المسودة الأحدث للمقارنة.')
 if(response.status===503)throw Error('حفظ مسودات النصوص لم يُفعّل على الخادم بعد. يمكنك تصدير تعديلك للاحتفاظ به.')
 if(!response.ok)throw Error('تعذّر تأكيد حفظ أو تحميل المسودة؛ احتفظ بنصك وأعد المحاولة.')
 const payload=await response.json() as {draft?:unknown}
 if(!current())throw Error('تغيّرت جلسة الإدارة؛ افتح المحرر من جديد.')
 if(payload.draft===null&&!input)return null
 if(!validBokTextDraft(payload.draft)||input&&(payload.draft.baseHash!==input.baseHash||payload.draft.text!==input.text||payload.draft.revision!==input.expectedRevision+1))throw Error('استجابة حفظ غير صالحة؛ لم يُؤكد حفظ النص.')
 return payload.draft
}
import {routeLocation} from "./path_location"

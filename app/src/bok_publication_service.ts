import {boundedReleaseJson} from './bok_active_release'
export interface BokPublicationJob{id:string;bookId:string;status:'awaiting_operator'|'building'|'needs_review'|'failed'|'published';releaseId:string|null;failureCode:string|null;createdAt:string}
export async function bokEditorialCapabilities(current:()=>boolean){
 if(!current())throw Error('تغيّرت جلسة التحرير.')
 const response=await fetch('/api/admin/bok-publication',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)})
 if(!current()||!response.ok)return{editingEnabled:false,submissionEnabled:false}
 const value=await boundedReleaseJson(response,8192) as {editingEnabled?:boolean;submissionEnabled?:boolean}
 return{editingEnabled:value.editingEnabled===true,submissionEnabled:value.editingEnabled===true&&value.submissionEnabled===true}
}
export async function bokPublicationRequest(current:()=>boolean,bookId:string,input?:{sourceHash:string;reviews:Array<{pageId:number;revision:number;baseHash:string;text:string}>}):Promise<BokPublicationJob|null>{
 if(!current())throw Error('تغيّرت جلسة التحرير.')
 const response=await fetch('/api/admin/bok-publication'+(input?'':'?'+new URLSearchParams({bookId})),{method:input?'POST':'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),headers:input?{'content-type':'application/json','x-alkhizana-request':'account-ui'}:{accept:'application/json'},...(input?{body:JSON.stringify({id:crypto.randomUUID(),bookId,...input})}:{})})
 if(!current())throw Error('تغيّرت جلسة التحرير.')
 if(response.status===409)throw Error('تغيّرت مسودة أثناء طلب النشر؛ راجع النسخة الأحدث.')
 if(!response.ok)throw Error('تعذّر تسجيل طلب النشر؛ لم يُنشر أي تعديل.')
 const data=await boundedReleaseJson(response,16384) as {job?:BokPublicationJob|null}
 if(data.job===null&&!input)return null
 if(!data.job||data.job.bookId!==bookId||!['awaiting_operator','building','needs_review','failed','published'].includes(data.job.status))throw Error('استجابة طلب النشر غير صالحة.')
 return data.job
}
export function bokPublicationStatus(job:BokPublicationJob):string{return({awaiting_operator:'سُجّل طلب المراجعة في الخادم؛ ينتظر بناء الإصدار والتحقق بواسطة مسؤول النشر. لم يُنشر بعد.',building:'يجري بناء الإصدار والتحقق منه؛ لم يُنشر بعد.',needs_review:'يحتاج طلب النشر إلى مراجعة التصحيحات مجددًا.',failed:'تعذّر تجهيز الإصدار؛ بقي النص المنشور كما هو.',published:'نُشرت التصحيحات ضمن إصدار موثّق.'})[job.status]}

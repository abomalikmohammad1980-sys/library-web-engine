import type {WordImportProgress} from './word_import_progress'
const origin='http://localhost:43129'
let connectionToken=''
export function hasConnectedWordSession():boolean{return Boolean(connectionToken)}
export function forgetConnectedWord():void{connectionToken=''}
async function request(path:string,init:RequestInit={},timeout=10000):Promise<Response>{
 const token=connectionToken
 if(!token)throw Error('اربط مساعد Word من نافذة الرفع أولًا.')
 try{
  const response=await fetch(origin+path,{...init,headers:{...init.headers,'X-Khizana-Token':token},mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(timeout)})
  if(token!==connectionToken)throw Error('تغيّر اتصال مساعد Word؛ أعد المحاولة.')
  if(response.status===401){connectionToken='';throw Error('رمز اتصال Word غير صالح؛ انسخ الرمز من المساعد مجددًا.')}
  return response
 }catch(error){if(error instanceof TypeError)throw Error('تعذّر الاتصال بمساعد Word. شغّله واسمح باتصال الموقع بالجهاز المحلي إن طلب المتصفح ذلك.');throw error}
}
export async function connectWord(token:string):Promise<void>{
 if(!/^[a-f0-9]{64}$/.test(token.trim()))throw Error('انسخ رمز الاتصال الكامل من نافذة مساعد Word.')
 connectionToken=token.trim()
 try{const response=await request('/v1/status');const value=await response.json();if(!response.ok||value.contract!=='khizana-connected-word/1'||value.ready!==true)throw Error('إصدار المساعد غير متوافق.')}
 catch(error){connectionToken='';throw error}
}
export async function convertWithConnectedWord(file:File,onProgress:(value:WordImportProgress)=>void=()=>{}):Promise<Uint8Array>{
 const format=file.name.toLowerCase().match(/\.(docx|doc|rtf)$/)?.[1]
 if(!format||file.size>64*1024*1024)throw Error('اختر DOCX أو DOC أو RTF بحجم لا يتجاوز 64 ميجابايت.')
 const session=connectionToken
 onProgress({stage:'sending'})
 const started=await request('/v1/jobs',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Khizana-Format':format},body:file},60000)
 if(started.status===409)throw Error('Word يعالج ملفًا آخر؛ انتظر اكتماله ثم أعد المحاولة.')
 if(!started.ok)throw Error('تعذّر بدء معالجة الملف في Word.')
 const job=await started.json() as {jobId?:string}
 if(!/^[a-f0-9]{32}$/.test(job.jobId??''))throw Error('استجابة المساعد غير صالحة.')
 const deadline=Date.now()+31*60*1000
 while(Date.now()<deadline){
  if(session!==connectionToken)throw Error('تغيّر اتصال المساعد؛ لم يُرفع الملف.')
  onProgress({stage:'processing'});await new Promise(resolve=>setTimeout(resolve,1000))
  const result=await request('/v1/jobs/'+job.jobId,{},60000)
  if(result.status===202)continue
  if(!result.ok)throw Error('لم تكتمل معالجة Word؛ لم يُرفع الملف. راجع نافذة المساعد وسجل العملية.')
  if(result.headers.get('Content-Type')?.split(';')[0]!=='application/vnd.khizana.word-package')throw Error('نوع استجابة المساعد غير صحيح.')
  const length=Number(result.headers.get('Content-Length'))
  if(length>128*1024*1024)throw Error('حزمة Word أكبر من الحد المسموح.')
  const total=Number.isSafeInteger(length)&&length>0?length:undefined
  const reader=result.body?.getReader();if(!reader)throw Error('حزمة Word فارغة.')
  const chunks:Uint8Array[]=[];let size=0
  onProgress({stage:'receiving',loaded:0,total})
  try{while(true){const part=await reader.read();if(session!==connectionToken)throw Error('تغيّر اتصال المساعد؛ لم يُرفع الملف.');if(part.done)break;size+=part.value.length;if(size>128*1024*1024)throw Error('حزمة Word أكبر من الحد المسموح.');chunks.push(part.value);onProgress({stage:'receiving',loaded:size,total})}
   if(total!==undefined&&size!==total)throw Error('حزمة Word غير مكتملة؛ أعد المحاولة من الملف الأصلي.')
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  return bytes
 }
 throw Error('انتهت مهلة معالجة Word؛ لم يُرفع الملف.')
}

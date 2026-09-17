/** One cancellable parse at a time per book; do not transfer/detach stored bytes. */
export async function extractLocalWordParagraphs(data:Uint8Array,signal?:AbortSignal,identityActive:()=>void=()=>{}):Promise<Array<{index:number;text:string}>>{
 identityActive()
 if(signal?.aborted)throw new DOMException('Local index cancelled','AbortError')
 if(typeof Worker==='undefined'){
  const {extractFromDocx}=await import('@engine/ooxml-model')
  identityActive()
  if(signal?.aborted)throw new DOMException('Local index cancelled','AbortError')
  return extractFromDocx(data).paragraphs.filter(p=>!p.excluded&&Boolean(p.text)).map(p=>({index:p.index,text:p.text}))
 }
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('../local_docx_index.worker.ts',import.meta.url),{type:'module'})
  let settled=false
  const cleanup=()=>{settled=true;worker.onmessage=null;worker.onerror=null;worker.terminate();clearTimeout(timer);signal?.removeEventListener('abort',abort);globalThis.removeEventListener?.('alkhizana:account-changed',abort)}
  const abort=()=>{if(settled)return;cleanup();reject(new DOMException('Local index cancelled','AbortError'))}
  const timer=setTimeout(()=>{cleanup();reject(Error('local_docx_worker_deadline'))},120_000)
  signal?.addEventListener('abort',abort,{once:true});globalThis.addEventListener?.('alkhizana:account-changed',abort)
  worker.onerror=()=>{if(settled)return;cleanup();reject(Error('local_docx_worker_failed'))}
  worker.onmessage=event=>{if(settled)return;try{identityActive()}catch(error){cleanup();reject(error);return}cleanup();const rows=event.data?.paragraphs;if(!Array.isArray(rows)||rows.some(p=>!Number.isSafeInteger(p.index)||p.index<0||typeof p.text!=='string')){reject(Error('local_docx_parse_failed'));return}resolve(rows)}
  if(signal?.aborted){abort();return}
  try{worker.postMessage(data)}catch(error){cleanup();reject(error)}
 })
}

const MAX_BODY_BYTES=40_000
export async function translationBody(request){
 if(Number(request.headers.get('content-length'))>MAX_BODY_BYTES)throw new Error('translation_body_too_large')
 const reader=request.body?.getReader();if(!reader)throw new Error('translation_body_invalid')
 const chunks=[];let bytes=0,timer
 try{
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{void reader.cancel();reject(new Error('translation_body_timeout'))},5000)})
  for(;;){const item=await Promise.race([reader.read(),timeout]);if(item.done)break;bytes+=item.value.length;if(bytes>MAX_BODY_BYTES){await reader.cancel();throw new Error('translation_body_too_large')}chunks.push(item.value)}
  const data=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}
  const value=JSON.parse(new TextDecoder().decode(data));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('translation_body_invalid');return value
 }finally{clearTimeout(timer);reader.releaseLock()}
}
/** Atomic shared limits; no raw IP or translated text is persisted. */
export async function translationLimited(context,purpose){
 const db=context.env?.VISITORS_DB;if(typeof db?.prepare!=='function')throw new Error('translation_guard_unavailable')
 const now=Math.floor(Date.now()/1000),ip=context.request.headers.get('cf-connecting-ip')||'unknown'
 for(const [kind,value,window,max] of [['client',ip,900,purpose==='ui'?120:30],['total','site',86400,2000]]){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${kind}:${value}:${Math.floor(now/window)}`))
  const bucket='translation:'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')
  const row=await db.prepare('INSERT INTO account_auth_limits(bucket,attempts,expires_at) VALUES(?1,1,?2) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(bucket,now+window).first()
  if(!row||row.attempts>max)return window-(now%window)
 }
 await db.prepare("DELETE FROM account_auth_limits WHERE bucket LIKE 'translation:%' AND expires_at<?1").bind(now).run()
 return 0
}

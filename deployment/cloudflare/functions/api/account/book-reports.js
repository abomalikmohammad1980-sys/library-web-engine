import {trustedAccount,trustedMutation,json} from '../_account-contract.js'
export async function onRequestPost(context){
 if(!trustedMutation(context.request))return json({error:'cross_origin_forbidden'},403)
 const account=await trustedAccount(context);if(!account)return json({error:'sign_in_required'},401)
 let input
 try{
  if(!context.request.headers.get('content-type')?.includes('application/json')||!context.request.body)throw Error()
  const reader=context.request.body.getReader(),chunks=[];let size=0
  try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>16000)throw Error();chunks.push(r.value)}}finally{await reader.cancel();reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}input=JSON.parse(new TextDecoder().decode(bytes))
 }catch{return json({error:'invalid_report'},400)}
 const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)
 if(input?.reporterSubject!==account.subject||input.contract!=='alkhizana-book-issue-report/1'||!text(input.bookId,160)||!text(input.bookTitle,240)||!text(input.message,1200)||input.message.trim().length<8||!['title','author','category','file','other','comment','correction'].includes(input.kind))return json({error:'invalid_report'},400)
 const position=input.context??{}
 if(!position||typeof position!=='object'||Array.isArray(position)||Object.keys(position).some(k=>!['part','page','pageIndex','paragraphIndex','selectedText'].includes(k)))return json({error:'invalid_position'},400)
 for(const key of ['part','page','pageIndex','paragraphIndex'])if(position[key]!==undefined&&(!Number.isSafeInteger(position[key])||position[key]<(['pageIndex','paragraphIndex'].includes(key)?0:1)||position[key]>100000))return json({error:'invalid_position'},400)
 if(position.selectedText!==undefined&&!text(position.selectedText,500))return json({error:'invalid_selection'},400)
 const db=context.env.VISITORS_DB,id=crypto.randomUUID()
 try{
  const result=await db.prepare("INSERT INTO book_reader_reports(id,reporter_subject,book_id,book_title,kind,message,context_json) SELECT ?1,?2,?3,?4,?5,?6,?7 WHERE (SELECT COUNT(*) FROM book_reader_reports WHERE reporter_subject=?2 AND created_at>=date('now'))<5 AND NOT EXISTS(SELECT 1 FROM book_reader_reports WHERE reporter_subject=?2 AND book_id=?3 AND message=?6 AND context_json=?7)").bind(id,account.subject,input.bookId,input.bookTitle,input.kind,input.message.trim(),JSON.stringify(position)).run()
  if(Number(result.meta?.changes)!==1)return json({error:'duplicate_or_daily_limit'},409)
  return json({ok:true,id},201)
 }catch{return json({error:'reports_unavailable'},503)}
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'POST'})

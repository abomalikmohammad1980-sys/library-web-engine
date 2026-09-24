import {json,trustedAccount,isManager} from '../../_account-contract.js'
export async function onRequest(context){
 if(context.request.method!=='GET'&&context.request.method!=='HEAD')return json({error:'method_not_allowed'},405,{allow:'GET, HEAD'})
 if(!/^att-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(context.params.attachmentId))return json({error:'attachment_not_found'},404)
 try{
  const row=await context.env.VISITORS_DB.prepare('SELECT owner_subject,object_key,file_name,format,byte_length,state,sha256,revision FROM download_attachments WHERE id=?1').bind(context.params.attachmentId).first()
  if(!row)return json({error:'attachment_not_found'},404)
  if(row.state!=='public'){const account=await trustedAccount(context);if(!account||account.subject!==row.owner_subject&&!isManager(account))return json({error:'attachment_not_found'},404)}
  const object=context.request.method==='HEAD'?await context.env.LIBRARY_R2.head(row.object_key):await context.env.LIBRARY_R2.get(row.object_key)
  if(!object||object.size!==row.byte_length)return json({error:'attachment_not_found'},404)
  const current=await context.env.VISITORS_DB.prepare('SELECT state,revision FROM download_attachments WHERE id=?1').bind(context.params.attachmentId).first()
  if(!current||current.revision!==row.revision||current.state!==row.state){await object.body?.cancel();return json({error:'attachment_not_found'},404)}
  return new Response(context.request.method==='HEAD'?null:object.body,{headers:{'content-type':row.format==='zip'?'application/zip':'application/vnd.rar','content-length':String(row.byte_length),'content-disposition':`attachment; filename="archive.${row.format}"; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,'cache-control':'private, no-store','content-security-policy':"sandbox; default-src 'none'",'cross-origin-resource-policy':'same-origin','x-content-type-options':'nosniff','x-content-sha256':row.sha256}})
 }catch{return json({error:'attachments_unavailable'},503)}
}

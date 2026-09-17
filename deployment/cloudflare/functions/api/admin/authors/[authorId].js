import {canEditLibrary,isSuperAdmin,json,trustedAccount,trustedMutation} from '../../_account-contract.js'
import {decodeRouteId} from '../../_route-id.js'
import {validateAuthorFields,publicAuthorFields} from '../../_author-structured-fields.js'
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9:_-]{0,199}$/.test(id)
const invalid=details=>json({error:'invalid_author_override',details},400)
function fieldError(field,value,maxLength,optional=false){
 if(optional&&value===undefined)return null
 if(typeof value!=='string')return{field,reason:'invalid_type'}
 if(value.length>maxLength)return{field,reason:'too_long',maxLength,actualLength:value.length,unit:'utf16_code_units'}
 if(!value.trim())return optional||field==='biography'?null:{field,reason:'required'}
 if(/[<>]/.test(value))return{field,reason:'unsupported_markup'}
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))return{field,reason:'control_characters'}
 return null
}
async function boundedBody(request){
 if(!request.headers.get('content-type')?.includes('application/json')||!request.body)throw Error('body')
 const reader=request.body.getReader(),parts=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536)throw Object.assign(Error('body'),{details:{field:'request',reason:'too_long',maxLength:65536,actualLength:size,unit:'bytes'}});parts.push(value)}}catch(e){await reader.cancel();throw e}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
}
export async function onRequestPatch(context){
 if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
 try{
  const account=await trustedAccount(context);if(!canEditLibrary(account))return json({error:'editor_required'},403)
  const id=decodeRouteId(context.params.authorId);if(!validId(id))return json({error:'invalid_author_id'},400)
  let body;try{body=await boundedBody(context.request)}catch(error){return invalid(error.details??{field:'request',reason:'invalid_request'})}
  const fields=new Set(['expectedVersion','displayName','biography','source','reason','fields'])
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!fields.has(key)))return invalid({field:'request',reason:'invalid_request'})
  if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||body.expectedVersion>=2147483647)return invalid({field:'expectedVersion',reason:'invalid_request'})
  for(const [field,max,optional] of [['displayName',300,false],['biography',20000,false],['source',2000,true],['reason',1000,true]]){const error=fieldError(field,body[field],max,optional);if(error)return invalid(error)}
  if(/file:|[A-Za-z]:\\|(?:^|\s)private\//i.test(body.source??''))return invalid({field:'source',reason:'private_source'})
  const db=context.env.VISITORS_DB,version=body.expectedVersion+1,name=body.displayName.trim(),biography=body.biography.trim(),source=(body.source??'').trim(),reason=(body.reason??'').trim()
  if(body.fields!==undefined){const issue=validateAuthorFields(body.fields);if(issue)return invalid(issue)}
  const existing=await db.prepare('SELECT revision,fields_json AS fieldsJson FROM author_overrides WHERE author_id=?1').bind(id).first()
  if(Number(existing?.revision??0)!==body.expectedVersion)return json({error:'author_override_conflict'},409)
  const prior=JSON.parse(existing?.fieldsJson??'{}');if(validateAuthorFields(prior))throw Error('stored_author_fields_invalid')
  const merged={...prior,...(body.fields??{})},issue=validateAuthorFields(merged);if(issue)return invalid(issue)
  const fieldsJson=JSON.stringify(merged)
  const update=db.prepare('INSERT INTO author_overrides(author_id,display_name,biography,source,revision,updated_by,fields_json) SELECT ?1,?2,?3,?4,?5,?6,?8 WHERE ?7=0 OR EXISTS(SELECT 1 FROM author_overrides WHERE author_id=?1 AND revision=?7) ON CONFLICT(author_id) DO UPDATE SET disabled=0,fields_json=excluded.fields_json,display_name=excluded.display_name,biography=excluded.biography,source=excluded.source,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP WHERE author_overrides.revision=?7').bind(id,name,biography,source,version,account.subject,body.expectedVersion,fieldsJson)
  const audit=db.prepare('INSERT INTO author_override_history(author_id,revision,display_name,biography,source,reason,actor_subject,fields_json) SELECT ?1,?2,?3,?4,?5,?6,?7,?8 WHERE changes()=1').bind(id,version,name,biography,source,reason,account.subject,fieldsJson)
  const receipt=db.prepare('INSERT INTO author_override_write_receipts(author_id,revision,complete) SELECT ?1,?2,CASE WHEN EXISTS(SELECT 1 FROM author_override_history WHERE author_id=?1 AND revision=?2 AND actor_subject=?3 AND display_name=?4 AND biography=?5 AND source=?6 AND fields_json=?7 AND reason=?8) THEN 1 ELSE 0 END WHERE EXISTS(SELECT 1 FROM author_overrides WHERE author_id=?1 AND revision=?2 AND updated_by=?3 AND display_name=?4 AND biography=?5 AND source=?6 AND fields_json=?7) ON CONFLICT(author_id,revision) DO NOTHING').bind(id,version,account.subject,name,biography,source,fieldsJson,reason)
  const [result]=await db.batch([update,audit,receipt])
  if(Number(result?.meta?.changes)!==1)return json({error:'author_override_conflict'},409)
  return json({authorId:id,revision:version})
 }catch{return json({error:'author_overrides_unavailable'},503)}
}
export async function onRequestGet(context){
 try{
  const account=await trustedAccount(context);if(!isSuperAdmin(account))return json({error:'super_admin_required'},403)
  const id=decodeRouteId(context.params.authorId),params=new URL(context.request.url).searchParams,limit=Number(params.get('limit')??20),before=Number(params.get('beforeVersion')??2147483647)
  if(!validId(id)||[...params.keys()].some(k=>!['limit','beforeVersion'].includes(k)||params.getAll(k).length!==1)||!Number.isSafeInteger(limit)||limit<1||limit>50||!Number.isSafeInteger(before)||before<1)return json({error:'invalid_history_page'},400)
  const result=await context.env.VISITORS_DB.prepare('SELECT revision,display_name AS displayName,biography,source,fields_json AS fieldsJson,reason,created_at AS createdAt FROM author_override_history WHERE author_id=?1 AND revision<?2 ORDER BY revision DESC LIMIT ?3').bind(id,before,limit+1).all()
  const rows=result.results??[],history=rows.slice(0,limit).map(publicAuthorFields)
  return json({authorId:id,history,hasMore:rows.length>limit,nextBeforeVersion:rows.length>limit?history.at(-1).revision:null})
 }catch{return json({error:'author_overrides_unavailable'},503)}
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET, PATCH'})

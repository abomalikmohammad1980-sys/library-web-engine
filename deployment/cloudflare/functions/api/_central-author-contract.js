import {canEditLibrary,json,trustedAccount,trustedMutation} from './_account-contract.js'
import {decodeRouteId} from './_route-id.js'
import {validateAuthorFields} from './_author-structured-fields.js'
export const validCentralAuthorId=id=>typeof id==='string'&&/^central-author:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)
const plain=(value,max,optional=false)=>typeof value==='string'&&value.length<=max&&(optional||value.trim().length>0)&&!/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
async function body(request){
 if(!request.headers.get('content-type')?.includes('application/json')||!request.body)throw Error('body')
 const reader=request.body.getReader(),parts=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536)throw Error('body');parts.push(value)}}catch(error){await reader.cancel();throw error}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
}
// Used in the write itself, not only in the request's earlier role check.
const ACTOR_SQL="EXISTS(SELECT 1 FROM accounts a WHERE a.subject=?8 AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1)))) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=?8 AND blocked=1)"
export async function mutateCentralAuthor(context,create){
 if(!trustedMutation(context.request))return json({error:'cross_site_request_rejected'},403)
 try{
  const actor=await trustedAccount(context);if(!canEditLibrary(actor))return json({error:'editor_required'},403)
  const authorId=create?'central-author:'+crypto.randomUUID():decodeRouteId(context.params.authorId)
  if(!validCentralAuthorId(authorId))return json({error:'invalid_central_author_id'},400)
  let input;try{input=await body(context.request)}catch{return json({error:'invalid_central_author'},400)}
  const allowed=['displayName','biography','source','reason','deathYearHijri','contemporary','fields',...(!create?['expectedVersion']:[])]
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k))||!plain(input.displayName,300)||!plain(input.biography,20000,true)||!plain(input.source??'',2000,true)||!plain(input.reason??'',1000,true)||/file:|[A-Za-z]:\\|(?:^|\s)private\//i.test(input.source??''))return json({error:'invalid_central_author'},400)
  let death=input.deathYearHijri??null,contemporary=input.contemporary??false;const expected=create?0:input.expectedVersion
  if(death!==null&&(!Number.isSafeInteger(death)||death< -10000||death>3000)||typeof contemporary!=='boolean'||contemporary&&death!==null||!Number.isSafeInteger(expected)||expected<0||expected>=2147483647||!create&&expected===0)return json({error:'invalid_central_author'},400)
  const db=context.env.VISITORS_DB,version=expected+1,name=input.displayName.trim(),biography=input.biography.trim(),source=(input.source??'').trim(),reason=(input.reason??'').trim()
  let existing
  if(!create){existing=await db.prepare('SELECT revision,fields_json AS fieldsJson,death_year_hijri AS death,contemporary FROM central_authors WHERE author_id=?1 AND hidden_at IS NULL').bind(authorId).first();if(!existing)return json({error:'central_author_not_found'},404);if(Number(existing.revision)!==expected)return json({error:'central_author_conflict'},409)}
  if(input.fields!==undefined&&validateAuthorFields(input.fields))return json({error:'invalid_central_author'},400)
  const prior=JSON.parse(existing?.fieldsJson??'{}');if(validateAuthorFields(prior))throw Error('stored_fields')
  const merged={...prior,...(input.fields??{})},hasDeath=Object.prototype.hasOwnProperty.call(input,'deathYearHijri'),hasFieldDeath=Object.prototype.hasOwnProperty.call(input.fields??{},'deathHijri')
  if(hasDeath&&hasFieldDeath&&input.deathYearHijri!==input.fields.deathHijri)return json({error:'invalid_central_author'},400)
  death=hasFieldDeath?input.fields.deathHijri:hasDeath?input.deathYearHijri:existing?.death??null
  contemporary=input.contemporary??Boolean(existing?.contemporary??false)
  merged.deathHijri=death
  if(contemporary&&death!==null||validateAuthorFields(merged))return json({error:'invalid_central_author'},400)
  const fieldsJson=JSON.stringify(merged)
  // Applied migration0018 requires at least one character; normalize this internal sentinel on public read.
  const storedBiography=biography||' '
  const write=create
   ?db.prepare(`INSERT INTO central_authors(author_id,display_name,biography,source,death_year_hijri,contemporary,revision,updated_by,fields_json) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9 WHERE ${ACTOR_SQL}`).bind(authorId,name,storedBiography,source,death,Number(contemporary),version,actor.subject,fieldsJson)
   :db.prepare(`UPDATE central_authors SET fields_json=?10,display_name=?2,biography=?3,source=?4,death_year_hijri=?5,contemporary=?6,revision=?7,updated_by=?8,updated_at=CURRENT_TIMESTAMP WHERE author_id=?1 AND revision=?9 AND hidden_at IS NULL AND ${ACTOR_SQL}`).bind(authorId,name,storedBiography,source,death,Number(contemporary),version,actor.subject,expected,fieldsJson)
  const audit=db.prepare('INSERT INTO central_author_events(author_id,revision,actor_subject,action,display_name,biography,source,death_year_hijri,contemporary,reason,fields_json) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11 WHERE changes()=1').bind(authorId,version,actor.subject,create?'create':'update',name,biography,source,death,Number(contemporary),reason,fieldsJson)
  const [result]=await db.batch([write,audit]);if(Number(result?.meta?.changes)!==1)return json({error:'central_author_conflict'},409)
  return json({authorId,revision:version},create?201:200)
 }catch{return json({error:'central_authors_unavailable'},503)}
}

import {json} from '../_account-contract.js'
import {publicAuthorFields} from '../_author-structured-fields.js'
export async function onRequestGet(context){
 const params=new URL(context.request.url).searchParams,page=Number(params.get('page')??0),limit=Number(params.get('limit')??50)
 if(params.has('id')){
  const id=params.get('id')
  if([...params.keys()].some(k=>k!=='id')||params.getAll('id').length!==1||!id||!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,199}$/.test(id))return json({error:'invalid_author_id'},400)
  try{
   const override=await context.env.VISITORS_DB.prepare('SELECT author_id AS authorId,display_name AS displayName,biography,source,fields_json AS fieldsJson,revision,updated_at AS updatedAt FROM author_overrides WHERE author_id=?1 AND disabled=0').bind(id).first()
   return override?json({schemaVersion:1,override:publicAuthorFields(override)},200,{'cache-control':'no-store'}):json({error:'author_override_not_found'},404,{'cache-control':'no-store'})
  }catch{return json({error:'author_overrides_unavailable'},503)}
 }
 if([...params.keys()].some(k=>!['page','limit'].includes(k)||params.getAll(k).length!==1)||!Number.isSafeInteger(page)||page<0||page>10000||!Number.isSafeInteger(limit)||limit<1||limit>100)return json({error:'invalid_author_page'},400)
 try{
  const result=await context.env.VISITORS_DB.prepare('SELECT author_id AS authorId,display_name AS displayName,biography,source,fields_json AS fieldsJson,revision,updated_at AS updatedAt FROM author_overrides WHERE disabled=0 ORDER BY author_id LIMIT ?1 OFFSET ?2').bind(limit+1,page*limit).all(),rows=result.results??[]
  return json({schemaVersion:1,overrides:rows.slice(0,limit).map(publicAuthorFields),page,hasMore:rows.length>limit},200,{'cache-control':'no-store','cross-origin-resource-policy':'same-origin'})
 }catch{return json({error:'author_overrides_unavailable'},503)}
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})

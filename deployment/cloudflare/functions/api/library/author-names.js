import {json} from '../_account-contract.js'
// Only sparse editorial identities, never biographies or account information.
const registry=`WITH names AS (
 SELECT author_id,display_name,revision,disabled AS inactive FROM author_overrides
 UNION ALL SELECT author_id,display_name,revision,CASE WHEN hidden_at IS NULL THEN 0 ELSE 1 END FROM central_authors
)`
export async function onRequestGet(context){
 const p=new URL(context.request.url).searchParams,page=Number(p.get('page')??0),limit=Number(p.get('limit')??100)
 if([...p.keys()].some(k=>!['page','limit'].includes(k)||p.getAll(k).length!==1)||!Number.isSafeInteger(page)||page<0||page>100||!Number.isSafeInteger(limit)||limit<1||limit>100)return json({error:'invalid_author_names_page'},400)
 try{
  const results=await context.env.VISITORS_DB.batch([
   context.env.VISITORS_DB.prepare(`${registry} SELECT COUNT(*) AS count,COALESCE(SUM(revision),0) AS revisions,COALESCE(SUM(inactive),0) AS inactive FROM names`),
   context.env.VISITORS_DB.prepare(`${registry} SELECT author_id AS authorId,display_name AS displayName,revision FROM names WHERE inactive=0 ORDER BY author_id LIMIT ?1 OFFSET ?2`).bind(limit+1,page*limit),
  ])
  const stats=results[0].results[0],rows=results[1].results??[],version=`${stats.count}:${stats.revisions}:${stats.inactive}`
  const payload={schemaVersion:1,version,page,hasMore:rows.length>limit,names:rows.slice(0,limit)}
  const encoded=new TextEncoder().encode(JSON.stringify(payload)),digest=await crypto.subtle.digest('SHA-256',encoded),etag='"'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')+'"'
  const headers={'cache-control':'public, max-age=30','etag':etag,'cross-origin-resource-policy':'same-origin'}
  if(context.request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers})
  return json(payload,200,headers)
 }catch{return json({error:'author_names_unavailable'},503)}
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})

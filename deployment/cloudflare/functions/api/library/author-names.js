import {json} from '../_account-contract.js'
// Only sparse editorial identities, never biographies or account information.
const registry=`WITH names AS (
 SELECT author_id,display_name,revision,disabled AS inactive FROM author_overrides
 UNION ALL SELECT author_id,display_name,revision,CASE WHEN hidden_at IS NULL THEN 0 ELSE 1 END FROM central_authors
)`
export async function onRequestGet(context){
 const p=new URL(context.request.url).searchParams,page=Number(p.get('page')??0),limit=Number(p.get('limit')??100)
 if([...p.keys()].some(k=>!['page','limit'].includes(k)||p.getAll(k).length!==1)||!Number.isSafeInteger(page)||page<0||page>100||!Number.isSafeInteger(limit)||limit<1||limit>500)return json({error:'invalid_author_names_page'},400)
 // Encode pagination in the path: a zone rule that strips query strings from
 // cache keys must never let page 1 serve page 0's public registry entries.
 const cache=globalThis.caches?.default,cacheKey=new Request(`${new URL(context.request.url).origin}/api/library/author-names-cache-v1/${page}/${limit}`)
 if(cache)try{
  const cached=await cache.match(cacheKey)
  if(cached)return context.request.headers.get('if-none-match')===cached.headers.get('etag')
   ?new Response(null,{status:304,headers:cached.headers}):cached
 }catch{/* A cache outage must not make the public registry unavailable. */}
 try{
  const results=await context.env.VISITORS_DB.batch([
   context.env.VISITORS_DB.prepare(`${registry} SELECT COUNT(*) AS count,COALESCE(SUM(revision),0) AS revisions,COALESCE(SUM(inactive),0) AS inactive FROM names`),
   context.env.VISITORS_DB.prepare(`${registry} SELECT author_id AS authorId,display_name AS displayName,revision FROM names WHERE inactive=0 ORDER BY author_id LIMIT ?1 OFFSET ?2`).bind(limit+1,page*limit),
  ])
  const stats=results[0].results[0],rows=results[1].results??[],version=`${stats.count}:${stats.revisions}:${stats.inactive}`
  const payload={schemaVersion:1,version,page,hasMore:rows.length>limit,names:rows.slice(0,limit)}
  const encoded=new TextEncoder().encode(JSON.stringify(payload)),digest=await crypto.subtle.digest('SHA-256',encoded),etag='"'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')+'"'
  const headers={'cache-control':'public, max-age=300','etag':etag,'cross-origin-resource-policy':'same-origin'}
  const response=json(payload,200,headers)
  if(cache){const write=cache.put(cacheKey,response.clone()).catch(()=>undefined);if(context.waitUntil)context.waitUntil(write);else await write}
  return context.request.headers.get('if-none-match')===etag?new Response(null,{status:304,headers}):response
 }catch{return json({error:'author_names_unavailable'},503)}
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})

import {json} from '../_account-contract.js'
export async function onRequestGet(context){
 const cache=globalThis.caches?.default,cacheKey=new Request(`${new URL(context.request.url).origin}/api/library/categories`)
 if(cache)try{
  const cached=await cache.match(cacheKey)
  if(cached){const etag=cached.headers.get('etag'),matches=context.request.headers.get('if-none-match')?.split(',').some(value=>value.trim()==='*'||value.trim().replace(/^W\//,'')===etag)
   return matches?new Response(null,{status:304,headers:cached.headers}):cached}
 }catch{/* Cache loss must leave the public categories readable. */}
 try{
  const rows=await context.env.VISITORS_DB.prepare('SELECT c.category_id,c.name,c.revision,a.alias FROM subject_categories c JOIN subject_category_aliases a ON a.category_id=c.category_id ORDER BY c.category_id,a.alias LIMIT 100001').all()
  if(rows.results.length>100000)return json({error:'categories_too_large'},503)
  const categories=new Map()
  for(const row of rows.results){if(!categories.has(row.category_id))categories.set(row.category_id,{id:row.category_id,name:row.name,revision:row.revision,aliases:[]});categories.get(row.category_id).aliases.push(row.alias)}
  const body=JSON.stringify({categories:[...categories.values()]})
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body))
  const etag='"'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')+'"'
  const headers={'cache-control':'public, max-age=30, must-revalidate','etag':etag,'content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff'}
  const matches=context.request.headers.get('if-none-match')?.split(',').some(value=>value.trim()==='*'||value.trim().replace(/^W\//,'')===etag)
  const response=new Response(body,{status:200,headers})
  if(cache){const write=cache.put(cacheKey,response.clone()).catch(()=>undefined);if(context.waitUntil)context.waitUntil(write);else await write}
  return matches?new Response(null,{status:304,headers}):response
 }catch{return json({error:'categories_unavailable'},503)}
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})

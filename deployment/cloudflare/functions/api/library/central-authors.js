import {json} from '../_account-contract.js'
import {validCentralAuthorId} from '../_central-author-contract.js'
import {publicAuthorFields} from '../_author-structured-fields.js'
const summary='author_id AS authorId,display_name AS displayName,death_year_hijri AS deathYearHijri,contemporary,revision'
const map=row=>({...row,contemporary:Number(row.contemporary)===1})
export async function onRequestGet(context){
 const params=new URL(context.request.url).searchParams
 try{
  if(params.has('id')){
   const id=params.get('id');if(!validCentralAuthorId(id)||[...params.keys()].some(k=>k!=='id')||params.getAll('id').length!==1)return json({error:'invalid_central_author_id'},400)
   const row=await context.env.VISITORS_DB.prepare(`SELECT ${summary},biography,source,fields_json AS fieldsJson FROM central_authors WHERE author_id=?1 AND hidden_at IS NULL`).bind(id).first()
   return row?json({author:publicAuthorFields({...map(row),biography:row.biography.trim()})},200,{'cache-control':'no-store'}):json({error:'central_author_not_found'},404)
  }
  const page=Number(params.get('page')??0),limit=Number(params.get('limit')??100),rawQuery=params.get('q')??'',query=rawQuery.trim()
  if([...params.keys()].some(k=>!['page','limit','q'].includes(k)||params.getAll(k).length!==1)||rawQuery.length>300||/[\u0000-\u001f\u007f]/.test(rawQuery)||!Number.isSafeInteger(page)||page<0||page>10000||!Number.isSafeInteger(limit)||limit<1||limit>100)return json({error:'invalid_central_author_page'},400)
  // This is a public, identity-independent list. Repeated page and suggestion
  // requests otherwise scan D1 again; keep exact author lookups uncached so
  // withdrawn or edited biographies are checked on every request.
  const cache=globalThis.caches?.default
  const cacheUrl=new URL('/api/library/central-authors',new URL(context.request.url).origin)
  cacheUrl.searchParams.set('page',String(page));cacheUrl.searchParams.set('limit',String(limit));if(query)cacheUrl.searchParams.set('q',query)
  const cacheKey=new Request(cacheUrl)
  if(cache)try{const cached=await cache.match(cacheKey);if(cached)return cached}catch{/* D1 remains authoritative when the edge cache fails. */}
  const result=await context.env.VISITORS_DB.prepare(`SELECT ${summary} FROM central_authors WHERE hidden_at IS NULL AND (?3='' OR instr(display_name,?3)>0) ORDER BY author_id LIMIT ?1 OFFSET ?2`).bind(limit+1,page*limit,query).all(),rows=result.results??[]
  const response=json({authors:rows.slice(0,limit).map(map),page,hasMore:rows.length>limit},200,{'cache-control':'public, max-age=30, must-revalidate'})
  if(cache){const write=cache.put(cacheKey,response.clone()).catch(()=>undefined);if(context.waitUntil)context.waitUntil(write);else await write}
  return response
 }catch{return json({error:'central_authors_unavailable'},503)}
}
export const onRequest=()=>json({error:'method_not_allowed'},405,{allow:'GET'})

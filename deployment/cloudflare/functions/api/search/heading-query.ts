import {CentralHeadingSearchClient,type CentralHeadingDictionarySnapshot} from '../../../../app/src/central_heading_search'
import release from '../../../../app/public/data/heading-release.json'
import {onRequest as headingAsset} from './headings/[[path]].js'

// Opt-in until edge CPU/memory and cold mobile latency have been measured.
// Only completed, verified, public dictionary data crosses request boundaries.
const dictionaries=new WeakMap<object,CentralHeadingDictionarySnapshot>()
const response=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})

export async function onRequest(context:{request:Request;waitUntil?:(promise:Promise<unknown>)=>void;env:{HEADING_QUERY_ENABLED?:string;HEADING_RELEASE_SHA256?:string;LIBRARY_R2?:object;[key:string]:unknown}}){
 if(context.env.HEADING_QUERY_ENABLED!=='1')return response(404,{error:'heading_query_disabled'})
 const {request,env}=context,url=new URL(request.url)
 if(request.method!=='GET')return response(405,{error:'method'})
 if(request.headers.get('sec-fetch-site')==='cross-site'||request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return response(403,{error:'origin'})
 const q=url.searchParams.get('q')??'',offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??20),bookIds=url.searchParams.getAll('bookId'),excluded=url.searchParams.getAll('exclude')
 if([...url.searchParams.keys()].some(key=>!['q','offset','limit','bookId','exclude'].includes(key))||['q','offset','limit'].some(key=>url.searchParams.getAll(key).length>1)||!q.trim()||q.length>200||!Number.isSafeInteger(offset)||offset<0||offset>10000||!Number.isSafeInteger(limit)||limit<1||limit>40||bookIds.length>200||bookIds.some(id=>!/^\d{1,10}$/.test(id))||excluded.length>8||excluded.some(value=>value.length>100))return response(400,{error:'input'})
 if(env.HEADING_RELEASE_SHA256!==release.releaseId||!env.LIBRARY_R2)return response(503,{error:'release'})
 // Public release only: key by the complete query contract and immutable release.
 // Hash terms rather than placing readers' search text into cache URLs.
 const cache=(globalThis.caches as CacheStorage&{default?:Cache}|undefined)?.default
 const keyBytes=new TextEncoder().encode(JSON.stringify([release.releaseId,q,offset,limit,bookIds,excluded]))
 const keyHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',keyBytes)),b=>b.toString(16).padStart(2,'0')).join('')
 const cacheKey=new Request(`${url.origin}/__heading_query_cache/v1/${keyHash}`)
 try{
  const hit=await cache?.match(cacheKey)
  if(hit){const headers=new Headers(hit.headers);headers.set('cache-control','no-store');headers.set('server-timing','heading;desc="cached"');return new Response(hit.body,{headers})}
 }catch{/* Cache availability must not determine search correctness. */}
 const started=performance.now()
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(10000)])
 let reads=0,metrics:Record<string,number>={}
 const baseURL=`${url.origin}${release.baseURL}`
 const client=new CentralHeadingSearchClient({baseURL,planTokens:true,countMode:'page',rowConcurrency:16,onMetrics:value=>{metrics=value},dictionaryBinary:release.dictionaryBinary,dictionarySnapshot:dictionaries.get(env.LIBRARY_R2),queryTimeoutMs:10000,maxQueryShardBytes:32*1024*1024,fetch:async(input,init)=>{
  signal.throwIfAborted()
  if(++reads>128)throw Error('heading_query_read_budget')
  const target=new URL(String(input));if(!target.href.startsWith(baseURL))throw Error('heading_query_path')
  return headingAsset({...context,request:new Request(target,{method:'GET',headers:init?.headers,signal:init?.signal??signal})})
 }})
 try{
  const result=await client.search(q,{offset,limit,...(bookIds.length?{bookIds}:{}),excluded,signal})
  const queryMetrics=metrics
  signal.throwIfAborted()
  dictionaries.set(env.LIBRARY_R2,await client.createDictionarySnapshot(signal))
  const body=JSON.stringify({...result,releaseId:release.releaseId})
  if(new TextEncoder().encode(body).length>256*1024)throw Error('heading_query_response_budget')
  const timing=['initializeMs','estimateMs','candidatesMs','rowsMs'].map(key=>`${key};dur=${Math.round(queryMetrics[key]??0)}`).join(', ')
  const resultHeaders={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','server-timing':`heading;dur=${Math.round(performance.now()-started)}, ${timing}`}
  if(cache&&context.waitUntil)context.waitUntil(cache.put(cacheKey,new Response(body,{headers:{...resultHeaders,'cache-control':'public, max-age=86400'}})).catch(()=>undefined))
  return new Response(body,{headers:resultHeaders})
 }catch(error){
  const code=error instanceof Error&&/^heading_[a-z_]+$/.test(error.message)?error.message:'search_failed'
  console.warn(JSON.stringify({event:'heading_query_failed',code}))
  return response(503,{error:'heading_query_unavailable'})
 }
}

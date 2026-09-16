import type {CentralHeadingProvider} from './central_heading_integration'
import {shamelaPublicBookId} from './shamela_public_identity'
import {fetchPackedHeadingPartition} from './heading_dictionary_release'
import {batchHeadingRanges} from './heading_range_batch'
import {loadHeadingBookRanges} from './heading_book_ranges'

/** Stable concatenation of disjoint, independently verified heading releases. */
export function combineHeadingProviders(first:CentralHeadingProvider,second:CentralHeadingProvider):CentralHeadingProvider{
 if([...second.coveredBookIds].some(id=>first.coveredBookIds.has(id)))throw Error('heading_coverage_overlap')
 // Both underlying clients have a one-flight guard. Keep it until every branch
 // has settled, including a sibling whose request is still unwinding on abort.
 let previous:Promise<unknown>=Promise.resolve()
 return {releaseId:`${first.releaseId}:${second.releaseId}`,coveredBookIds:new Set([...first.coveredBookIds,...second.coveredBookIds]),client:{async search(query,options={}){
  const before=previous
  let release!:()=>void
  previous=new Promise<void>(resolve=>{release=resolve})
  await before
  const controller=new AbortController()
  const cancel=()=>controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort',cancel,{once:true})
  if(options.signal?.aborted)cancel()
  try{
  controller.signal.throwIfAborted()
  const requestOptions={...options,signal:controller.signal}
  const offset=options.offset??0,limit=options.limit??20
  const scope=(provider:CentralHeadingProvider)=>options.bookIds?{bookIds:options.bookIds.filter(id=>provider.coveredBookIds.has(shamelaPublicBookId(id)))}:{}
  const requests=[
   first.client.search(query,{...requestOptions,...scope(first)}),
   second.client.search(query,{...requestOptions,...scope(second),offset:0,limit:0}),
  ]
  let pair:Awaited<ReturnType<typeof first.client.search>>[]
  try{pair=await Promise.all(requests)}catch(error){controller.abort(error);await Promise.allSettled(requests);throw error}
  const [a,b]=pair as [Awaited<ReturnType<typeof first.client.search>>,Awaited<ReturnType<typeof second.client.search>>]
  options.signal?.throwIfAborted()
  if(!a.totalExact||!b.totalExact)throw Error('heading_coverage_total_inexact')
  const remaining=Math.max(0,limit-a.hits.length)
  const tail=remaining&&b.total?await second.client.search(query,{...requestOptions,...scope(second),offset:Math.max(0,offset-a.total),limit:remaining}):b
  return {hits:[...a.hits,...tail.hits],total:a.total+b.total,totalExact:true,coverageComplete:a.coverageComplete&&b.coverageComplete&&tail.coverageComplete,indexedBooks:a.indexedBooks+b.indexedBooks}
  }finally{options.signal?.removeEventListener('abort',cancel);release()}
 }}}
}

export async function withCatalogHeadingSupplement(primary:CentralHeadingProvider):Promise<CentralHeadingProvider>{
 const [{default:descriptor},{CentralHeadingSearchClient},bookRanges]=await Promise.all([import('./heading_catalog_supplement.generated.json'),import('./central_heading_search'),loadHeadingBookRanges('supplement')])
 const baseURL=new URL(descriptor.baseURL,document.baseURI).href
 const batchedFetch=batchHeadingRanges(fetch)
 const fetchVerified:typeof fetch=async(input,init)=>{
  const url=new URL(String(input)),relative=url.href.startsWith(baseURL)?url.href.slice(baseURL.length):''
  const location=(descriptor as unknown as {locations?:Record<string,{path:string;offset:number;bytes:number;packBytes:number}>}).locations?.[relative]
  if(location)return fetchPackedHeadingPartition(new URL(location.path,baseURL),location,init,batchedFetch)
  const response=await fetch(input,init)
  if(String(input)!==new URL('manifest.json',baseURL).href)return response
  if(!response.ok)throw Error('heading_supplement_unavailable')
  const bytes=new Uint8Array(await response.arrayBuffer())
  const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')
  if(bytes.length!==descriptor.manifestBytes||sha!==descriptor.manifestSha256)throw Error('heading_supplement_integrity')
  return new Response(bytes,{headers:{'content-type':'application/json'}})
 }
 return combineHeadingProviders(primary,{releaseId:descriptor.manifestSha256,coveredBookIds:new Set(descriptor.sourceBookIds.map(shamelaPublicBookId)),client:new CentralHeadingSearchClient({baseURL,fetch:fetchVerified,planTokens:true,maxCandidateEntries:200_000,bookRanges})})
}

import {compareBooks,type BookSort} from './book_ordering'
import type {SunnahSearchScope,SunnahGlobalSearchPage} from './sunnah_global_search'

/** Sort the complete result set before slicing, never just the visible page. */
export function createSunnahResultPager(scope:SunnahSearchScope,fetchPage:(query:string,offset:number,limit:number,signal?:AbortSignal)=>Promise<SunnahGlobalSearchPage>){
 const metadata=new Map(scope.books.map(b=>[b.sourceBookId,b]))
 let cachedQuery='',cached:SunnahGlobalSearchPage|undefined
 return async(query:string,offset:number,limit:number,order:BookSort,signal?:AbortSignal):Promise<SunnahGlobalSearchPage>=>{
  if(order==='death')return fetchPage(query,offset,limit,signal)
  if(cachedQuery!==query||!cached){
   const first=await fetchPage(query,0,500,signal),hits=[...first.hits]
   if(!first.scopeCoverageComplete)throw Error('sunnah_order_incomplete')
   while(hits.length<first.total){
    if(signal?.aborted)throw new DOMException('Aborted','AbortError')
    const page=await fetchPage(query,hits.length,500,signal)
    if(!page.scopeCoverageComplete||page.total!==first.total||!page.hits.length)throw Error('sunnah_order_incomplete')
    hits.push(...page.hits)
   }
   if(signal?.aborted)throw new DOMException('Aborted','AbortError')
   cached={...first,hits};cachedQuery=query
  }
  const book=(hit:SunnahGlobalSearchPage['hits'][number])=>{const meta=metadata.get(hit.bookId),death=meta?.deathYearHijri??hit.deathYearHijri;return{id:hit.bookId,title:meta?.title??'',author:meta?.author??hit.author??'',...(death!=null?{deathYearHijri:death}:{})}}
  const compare=compareBooks(order),hits=[...cached.hits].sort((a,b)=>compare(book(a),book(b))||a.paragraphIndex-b.paragraphIndex||a.matchOffset-b.matchOffset)
  return{...cached,offset,limit,hits:hits.slice(offset,offset+limit)}
 }
}

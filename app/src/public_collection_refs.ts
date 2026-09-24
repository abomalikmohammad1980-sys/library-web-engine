import {shamelaPublicBookId} from './shamela_public_identity'
export type PublicCollectionRef={id:string;title:string}
export function parsePublicCategoryPage(html:string,path:string,page:number,origin:string):{books:PublicCollectionRef[];hasMore:boolean}{
 const doc=new DOMParser().parseFromString(html,'text/html'),main=doc.querySelector('main.seo-page')
 if(!main||doc.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex'))throw Error('collection_not_public')
 const books:PublicCollectionRef[]=[]
 for(const anchor of main.querySelectorAll<HTMLAnchorElement>('li a')){
  const url=new URL(anchor.getAttribute('href')??'',origin)
  const match=/^\/books\/(?:(\d+)|public\/([A-Za-z0-9_-]{1,200}))$/.exec(url.pathname)
  if(url.origin!==origin||url.search||url.hash||!match||!anchor.textContent?.trim())throw Error('collection_book_link_invalid')
  books.push({id:match[1]?shamelaPublicBookId(match[1]):`central-submission:${match[2]}`,title:anchor.textContent.trim()})
 }
 const next=main.querySelectorAll<HTMLAnchorElement>('nav a[rel="next"]')
 if(next.length>1)throw Error('collection_pagination_invalid')
 if(next[0]){
  const url=new URL(next[0].getAttribute('href')??'',origin)
  if(url.origin!==origin||decodeURIComponent(url.pathname)!==decodeURIComponent(path)||url.hash||url.searchParams.size!==1||url.searchParams.get('page')!==String(page+1))throw Error('collection_pagination_invalid')
 }
 return {books,hasMore:next.length===1}
}
/** Enumerate every public page sequentially; an incomplete list is never returned. */
export async function loadPublicCategoryCollection(category:string,signal:AbortSignal,options:{fetch?:typeof fetch;parse?:typeof parsePublicCategoryPage;origin?:string}={}):Promise<PublicCollectionRef[]>{
 const path='/categories/'+encodeURIComponent(category),fetcher=options.fetch??fetch,parse=options.parse??parsePublicCategoryPage,origin=options.origin??location.origin
 const books:PublicCollectionRef[]=[],seen=new Set<string>()
 for(let page=1;page<=1000;page++){
  if(signal.aborted)throw new DOMException('Cancelled','AbortError')
  const response=await fetcher(path+(page>1?'?page='+page:''),{headers:{Accept:'text/html'},credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])})
  if(!response.ok||!response.body)throw Error('collection_page_unavailable')
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0
  try{for(;;){if(signal.aborted)throw new DOMException('Cancelled','AbortError');const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>512000)throw Error('collection_page_too_large');chunks.push(value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const result=parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes),path,page,origin)
  for(const book of result.books){if(seen.has(book.id))throw Error('collection_changed');seen.add(book.id);books.push(book)}
  if(books.length>100000)throw Error('collection_too_large')
  if(signal.aborted)throw new DOMException('Cancelled','AbortError')
  if(!result.hasMore)return books
 }
 throw Error('collection_pagination_limit')
}

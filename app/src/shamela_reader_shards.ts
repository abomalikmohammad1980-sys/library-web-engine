import {fetchPagesDataAsset} from './pages_data_release'
import {materializeShamelaPackBook,type PackBook} from './shamela_pack_materialize'
import type {StoredBook} from './engine/library_store'

export interface ShamelaReaderShardDescriptor {path:string;start:number;count:number;bytes:number;sha256:string}
export interface ShamelaReaderShardIndex {
 contract:'shamela-reader-shards/1';workId:string;sourceSha256:string
 counts:{pages:number;titles:number};metadata:PackBook['metadata'];authors:PackBook['authors'];category:PackBook['category'];titles:PackBook['titles']
 pageRefs:Array<Pick<PackBook['pages'][number],'sourceRowId'|'part'|'page'|'number'>>
 shards:ShamelaReaderShardDescriptor[]
}
interface ShardCatalogEntry {bookId:string;batchId:string;sourceSha256:string;indexPath:string;indexBytes:number;indexSha256:string;counts:{pages:number;titles:number}}
interface ShardCatalog {contract:'shamela-reader-shards/catalog-1';minBytes:number;minPages?:number;books:ShardCatalogEntry[]}
export async function locateShamelaReaderShardRef(bookId:string,fetcher:typeof fetch=fetch):Promise<ShardCatalogEntry|undefined>{
 if(!/^\d+$/u.test(bookId))return undefined
 const catalog=JSON.parse(new TextDecoder().decode(await assetBytes('reader-shards/catalog.json',fetcher))) as ShardCatalog
 if(catalog.contract!=='shamela-reader-shards/catalog-1'||!Array.isArray(catalog.books))throw Error('shamela_reader_shard_catalog_invalid')
 const ref=catalog.books.find(book=>book.bookId===bookId)
 if(ref&&(!/^batch-\d{4}$/u.test(ref.batchId)||!HEX.test(ref.sourceSha256)))throw Error('shamela_reader_shard_catalog_mismatch')
 return ref
}
export interface ShamelaReaderRoute {contract:'shamela-reader-shards/route-1';workId:string;sourceSha256:string;counts:{pages:number;titles:number};metadata:PackBook['metadata'];authors:PackBook['authors'];category:PackBook['category'];indexPath:string;indexBytes:number;indexSha256:string;shards:ShamelaReaderShardDescriptor[]}
const HEX=/^[a-f0-9]{64}$/u
const digest=async(bytes:Uint8Array<ArrayBuffer>)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')
const cleanPath=(value:string)=>/^[a-z0-9][a-z0-9/_-]*\.json(?:\.gz)?$/u.test(value)&&!value.includes('..')
const progressiveBooks=new WeakMap<StoredBook,{load:(pageIndex:number)=>Promise<void>;loaded:Set<number>}>()
// The early page route and the complete TOC race intentionally. They must
// share the same immutable page group instead of downloading/decompressing it
// twice while the reader is already visible.
const recentShardLoads=new WeakMap<typeof fetch,Map<string,Promise<PackBook['pages']>>>()
export function shamelaPreviewPageLoader(book:StoredBook){return progressiveBooks.get(book)?.load}
export function shamelaPreviewPageLoaded(book:StoredBook,pageIndex:number){return progressiveBooks.get(book)?.loaded.has(pageIndex)??true}

export function validateShamelaReaderShardIndex(value:unknown,workId:string,sourceSha256:string,pages:number,titles:number):ShamelaReaderShardIndex{
 const index=value as ShamelaReaderShardIndex
 if(index?.contract!=='shamela-reader-shards/1'||index.workId!==workId||index.sourceSha256!==sourceSha256||index.counts?.pages!==pages||index.counts?.titles!==titles||index.titles?.length!==titles||index.pageRefs?.length!==pages||!Array.isArray(index.shards)||!index.shards.length)throw Error('shamela_reader_shard_index_invalid')
 let next=0
 for(const shard of index.shards){if(!cleanPath(shard.path)||!Number.isSafeInteger(shard.start)||shard.start!==next||!Number.isSafeInteger(shard.count)||shard.count<1||shard.count>1024||!Number.isSafeInteger(shard.bytes)||shard.bytes<1||shard.bytes>=25*1024*1024||!HEX.test(shard.sha256))throw Error('shamela_reader_shard_index_invalid');next+=shard.count}
 if(next!==pages)throw Error('shamela_reader_shard_coverage_invalid')
 return index
}

/** The reader may display only the requested window; TOC is complete. */
export function shamelaReaderWindow(index:ShamelaReaderShardIndex,pageIndex:number,radius=20){
 if(!Number.isSafeInteger(pageIndex)||pageIndex<0||pageIndex>=index.counts.pages||!Number.isSafeInteger(radius)||radius<0||radius>256)throw Error('shamela_reader_page_invalid')
 const first=Math.max(0,pageIndex-radius),last=Math.min(index.counts.pages-1,pageIndex+radius)
 const shards=index.shards.filter(shard=>shard.start<=last&&shard.start+shard.count>first)
 return {first,last,shards}
}

/** A tiny immutable route and the chosen page group arrive while the complete
 * TOC index downloads in parallel, for every large source with sidecars. */
export async function loadShamelaReaderEarlyWindow(bookId:string,batchId:string,sourceSha256:string,workId:string,pageCount:number,titleCount:number,pageIndex:number,fetcher:typeof fetch=fetch){
 if(!/^\d+$/u.test(bookId)||!/^batch-\d{4}$/u.test(batchId)||!HEX.test(sourceSha256)||!Number.isSafeInteger(pageIndex)||pageIndex<0||pageIndex>=pageCount)throw Error('shamela_reader_route_identity_invalid')
 const bytes=await assetBytes(`reader-shards/${batchId}/books/${bookId}/route.json`,fetcher)
 const route=JSON.parse(new TextDecoder().decode(bytes)) as ShamelaReaderRoute
 if(route.contract!=='shamela-reader-shards/route-1'||route.workId!==workId||route.sourceSha256!==sourceSha256||route.counts?.pages!==pageCount||route.counts?.titles!==titleCount||route.indexPath!==`${batchId}/books/${bookId}/index.json`&&route.indexPath!==`${batchId}/books/${bookId}/index.json.gz`||!HEX.test(route.indexSha256)||!Array.isArray(route.shards))throw Error('shamela_reader_route_invalid')
 let cursor=0;for(const shard of route.shards){if(!cleanPath(shard.path)||shard.start!==cursor||!Number.isSafeInteger(shard.count)||shard.count<1||shard.count>1024||!Number.isSafeInteger(shard.bytes)||shard.bytes<1||shard.bytes>=25*1024*1024||!HEX.test(shard.sha256))throw Error('shamela_reader_route_shards_invalid');cursor+=shard.count}
 if(cursor!==pageCount)throw Error('shamela_reader_route_coverage_invalid')
 const first=Math.max(0,pageIndex-20),last=Math.min(pageCount-1,pageIndex+20),shards=route.shards.filter(shard=>shard.start<=last&&shard.start+shard.count>first)
 const base=`reader-shards/${batchId}/books/${bookId}/`,parts=await Promise.all(shards.map(shard=>fetchShamelaReaderShard(route,shard,base,fetcher)))
 const pages=parts.flatMap((part,i)=>part.slice(Math.max(0,first-shards[i]!.start),Math.min(part.length,last-shards[i]!.start+1)))
 if(pages.length!==last-first+1)throw Error('shamela_reader_route_window_incomplete')
 return {index:route,first,last,pages}
}

async function assetBytes(path:string,fetcher:typeof fetch){
 const response=await fetchPagesDataAsset('corpus',path,`./library/shamela/${path}`,fetcher)
 if(!response.ok||response.headers.get('content-type')?.includes('text/html'))throw Error('shamela_reader_shard_unavailable')
 return new Uint8Array(await response.arrayBuffer())
}

/** An absent sidecar means the old verified full-pack path remains authoritative. */
export async function loadShamelaReaderWindow(bookId:string,batchId:string,sourceSha256:string,workId:string,pageCount:number,titleCount:number,pageIndex:number,fetcher:typeof fetch=fetch){
 if(!/^\d+$/u.test(bookId)||!/^batch-\d{4}$/u.test(batchId)||!HEX.test(sourceSha256))throw Error('shamela_reader_shard_identity_invalid')
 let catalog:ShardCatalog
 try{catalog=JSON.parse(new TextDecoder().decode(await assetBytes('reader-shards/catalog.json',fetcher))) as ShardCatalog}catch(error){if(error instanceof Error&&(error.message.startsWith('pages_asset_not_mapped:')||error.message==='shamela_reader_shard_unavailable'))return undefined;throw error}
 if(catalog.contract!=='shamela-reader-shards/catalog-1'||!Array.isArray(catalog.books))throw Error('shamela_reader_shard_catalog_invalid')
 const ref=catalog.books.find(x=>x.bookId===bookId&&x.batchId===batchId)
 if(!ref)return undefined
 const expectedPath=`${batchId}/books/${bookId}/index.json`
 if(ref.sourceSha256!==sourceSha256||![expectedPath,`${expectedPath}.gz`].includes(ref.indexPath)||ref.counts?.pages!==pageCount||ref.counts?.titles!==titleCount||!HEX.test(ref.indexSha256)||!Number.isSafeInteger(ref.indexBytes)||ref.indexBytes<1)throw Error('shamela_reader_shard_catalog_mismatch')
 const indexBytes=await assetBytes(`reader-shards/${ref.indexPath}`,fetcher)
 if(indexBytes.length!==ref.indexBytes||await digest(indexBytes)!==ref.indexSha256)throw Error('shamela_reader_shard_index_integrity')
 const indexText=ref.indexPath.endsWith('.gz')?await new Response(new Blob([indexBytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(indexBytes)
 const index=validateShamelaReaderShardIndex(JSON.parse(indexText),workId,sourceSha256,pageCount,titleCount)
 const window=shamelaReaderWindow(index,pageIndex)
 const base=`reader-shards/${batchId}/books/${bookId}/`
 const parts=await Promise.all(window.shards.map(shard=>fetchShamelaReaderShard(index,shard,base,fetcher)))
 const pages=parts.flatMap((part,i)=>part.slice(Math.max(0,window.first-window.shards[i]!.start),Math.min(part.length,window.last-window.shards[i]!.start+1)))
 if(pages.length!==window.last-window.first+1||pages.some((page,offset)=>page.sourceRowId!==index.pageRefs[window.first+offset]?.sourceRowId))throw Error('shamela_reader_shard_window_incomplete')
 return {index,first:window.first,last:window.last,pages}
}

/** The sparse book is session-only. Empty page text is never persisted or
 * advertised as complete search coverage; the caller starts the full pack in
 * the background and replaces this instance when it arrives. */
export function createShamelaPreviewBook(window:NonNullable<Awaited<ReturnType<typeof loadShamelaReaderWindow>>>|Awaited<ReturnType<typeof loadShamelaReaderEarlyWindow>>,bookId:string,batchId:string,catalogTitle:string,fetcher:typeof fetch=fetch):StoredBook{
 const {index,first,pages}=window
 const refs='pageRefs' in index?index.pageRefs:undefined
 const rawPages:PackBook['pages']=Array.from({length:index.counts.pages},(_,i)=>{const ref=refs?.[i];return{sourceRowId:ref?.sourceRowId??String(i+1),sequence:i,part:ref?.part??'1',page:ref?.page??i+1,number:ref?.number??null,body:null as string|null,foot:null as string|null}})
 for(const [offset,page] of pages.entries())rawPages[first+offset]={...page,number:page.number??null}
 const source:PackBook={contract:'shamela-sqlite-pack/book-1',workId:index.workId,metadata:index.metadata,authors:index.authors,category:index.category,pages:rawPages,titles:'titles' in index?index.titles:[]}
 const book=materializeShamelaPackBook(source,new Uint8Array(),index.sourceSha256,catalogTitle)
 const pending=new Map<string,Promise<void>>()
 const loaded=new Set(pages.map((_,offset)=>first+offset))
 const base=`reader-shards/${batchId}/books/${bookId}/`
 const load=(pageIndex:number):Promise<void>=>{
  if(!Number.isSafeInteger(pageIndex)||pageIndex<0||pageIndex>=index.counts.pages)return Promise.reject(Error('shamela_reader_page_invalid'))
  if(loaded.has(pageIndex))return Promise.resolve()
  const descriptor=index.shards.find(shard=>shard.start<=pageIndex&&shard.start+shard.count>pageIndex)
  if(!descriptor)return Promise.reject(Error('shamela_reader_shard_coverage_invalid'))
  let task=pending.get(descriptor.path)
  if(!task){task=(async()=>{
   const shard=await fetchShamelaReaderShard(index,descriptor,base,fetcher)
   if(refs)for(const [offset,page] of shard.entries())if(page.sourceRowId!==refs[descriptor.start+offset]?.sourceRowId)throw Error('shamela_reader_shard_page_identity_invalid')
   const prepared=materializeShamelaPackBook({...source,pages:shard.map((page,offset)=>({...page,page:page.page??descriptor.start+offset+1})),titles:[]},new Uint8Array(),index.sourceSha256,catalogTitle)
   for(const [offset,page] of prepared.bokPages!.entries()){book.bokPages![descriptor.start+offset]=page;loaded.add(descriptor.start+offset)}
  })().finally(()=>pending.delete(descriptor.path));pending.set(descriptor.path,task)}
  return task
 }
 progressiveBooks.set(book,{load,loaded})
 return book
}

export async function fetchShamelaReaderShard(index:Pick<ShamelaReaderShardIndex,'shards'|'workId'|'sourceSha256'>,descriptor:ShamelaReaderShardDescriptor,basePath:string,fetcher:typeof fetch=fetch):Promise<PackBook['pages']>{
 if(!index.shards.includes(descriptor)||!/^reader-shards\/batch-\d{4}\/books\/\d+\/$/u.test(basePath))throw Error('shamela_reader_shard_path_invalid')
 const path=`${basePath}${descriptor.path}`,key=`${path}:${descriptor.sha256}:${index.workId}:${index.sourceSha256}:${descriptor.start}:${descriptor.count}:${descriptor.bytes}`
 let cache=recentShardLoads.get(fetcher)
 if(!cache){cache=new Map();recentShardLoads.set(fetcher,cache)}
 const existing=cache.get(key)
 if(existing)return existing
 const pending=(async()=>{
  const compressed=await assetBytes(path,fetcher)
  if(compressed.length!==descriptor.bytes||await digest(compressed)!==descriptor.sha256)throw Error('shamela_reader_shard_integrity')
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))
  const decoded=JSON.parse(await new Response(stream).text()) as {contract?:string;workId?:string;sourceSha256?:string;start?:number;pages?:PackBook['pages']}
  if(decoded.contract!=='shamela-reader-shards/1'||decoded.workId!==index.workId||decoded.sourceSha256!==index.sourceSha256||decoded.start!==descriptor.start||decoded.pages?.length!==descriptor.count)throw Error('shamela_reader_shard_content_invalid')
  return decoded.pages
 })()
 cache.set(key,pending)
 if(cache.size>4)cache.delete(cache.keys().next().value!)
 void pending.catch(()=>{if(cache?.get(key)===pending)cache.delete(key)})
 return pending
}

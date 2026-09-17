import type { StoredBook } from './engine/library_store'
import { shamelaPublicBookId, shamelaSourceBookId } from './shamela_public_identity'
import type { ShamelaSearchClient, ShamelaSearchPage } from './shamela_search_client'

export const VERIFIED_SUNNAH_CATEGORIES = new Set(['كتب السنة','شروح الحديث','علوم الحديث','التخريج والأطراف','العلل والسؤالات الحديثية','العلل والسؤلات الحديثية'])
const UNKNOWN_SUNNAH_AUTHOR=/^(?:[-–—]+|unknown|غير معروف|مجهول|المؤلف مجهول|مؤلف غير معروف|مؤلف غير موثق)$/iu
export function isKnownSunnahAuthorName(value:string|undefined):boolean{return Boolean(value?.trim())&&!UNKNOWN_SUNNAH_AUTHOR.test(value!.trim())}
export interface SunnahSearchScope { contract:'sunnah-global-search-scope/1'; books:Array<{publicId:string;sourceBookId:string;title:string;category:string;author:string;authorId?:string;deathYearHijri?:number}> }
export interface SunnahGlobalSearchPage extends ShamelaSearchPage { scopeBooks:number; scopeCoverageComplete:boolean }
let completeScopeCache:Promise<SunnahSearchScope>|undefined
interface CompiledSunnahScope { publicIds:string[]; sourceIds:Set<string> }
const compiledScopeCache=new WeakMap<SunnahSearchScope,CompiledSunnahScope>()
function compiledSunnahScope(scope:SunnahSearchScope):CompiledSunnahScope{
  let cached=compiledScopeCache.get(scope)
  if(!cached){cached={publicIds:scope.books.map(x=>x.publicId),sourceIds:new Set(scope.books.map(x=>x.sourceBookId))};compiledScopeCache.set(scope,cached)}
  return cached
}

export async function completeSunnahSearchScope(scope:SunnahSearchScope,fetcher:typeof fetch=globalThis.fetch):Promise<SunnahSearchScope>{
  if(fetcher===globalThis.fetch&&completeScopeCache)return completeScopeCache
  const fetchJson=async<T>(url:string):Promise<T>=>{let last:unknown;for(let attempt=0;attempt<3;attempt++){try{const response=await fetcher(url,{cache:'force-cache'});if(response.ok)return response.json() as Promise<T>;last=new Error(`sunnah_catalog_http_${response.status}`)}catch(error){last=error}if(attempt<2)await new Promise(resolve=>setTimeout(resolve,40*(attempt+1)))}throw last}
  const task=(async()=>{if(fetcher===globalThis.fetch)try{const snapshot=await fetchJson<SunnahSearchScope>('./library/shamela/sunnah-scope.json');if(snapshot.contract==='sunnah-global-search-scope/1'&&snapshot.books.length&&snapshot.books.every(book=>book.sourceBookId&&book.publicId===shamelaPublicBookId(book.sourceBookId)&&VERIFIED_SUNNAH_CATEGORIES.has(book.category)&&typeof book.author==='string'&&book.author.trim()))return snapshot}catch{/* إصدارات قديمة: ارجع لبناء النطاق من الكتالوج */}
    const catalog=await fetchJson<{batches:Array<{manifest:string}>}>('./library/shamela/catalog.json'),known=new Set(scope.books.map(x=>x.sourceBookId)),extra:SunnahSearchScope['books']=[]
    const manifests=await Promise.all(catalog.batches.map(batch=>fetchJson<{books:Array<{bookId:string;catalog?:{title?:string;category?:string;author?:string|null;authorId?:string|null;deathYearHijri?:number|null}}> }>(batch.manifest)))
    for(const manifest of manifests)for(const book of manifest.books??[]){const category=book.catalog?.category;if(!category||!VERIFIED_SUNNAH_CATEGORIES.has(category)||known.has(book.bookId))continue;const rawAuthor=book.catalog?.author?.trim(),author=rawAuthor&&!/^[-–—]+$/u.test(rawAuthor)&&rawAuthor!=='غير معروف'?rawAuthor:'المؤلف مجهول';known.add(book.bookId);extra.push({publicId:shamelaPublicBookId(book.bookId),sourceBookId:book.bookId,title:book.catalog?.title??`كتاب السنة ${book.bookId}`,category,author,...(author!=='المؤلف مجهول'&&book.catalog?.authorId?{authorId:`shamela-author-${book.catalog.authorId}`} : {}),...(author!=='المؤلف مجهول'&&Number.isSafeInteger(book.catalog?.deathYearHijri)&&book.catalog?.deathYearHijri!==99999?{deathYearHijri:book.catalog!.deathYearHijri!}: {})})}
    return{...scope,books:[...scope.books,...extra].sort((a,b)=>Number(a.sourceBookId)-Number(b.sourceBookId))}})()
  if(fetcher===globalThis.fetch)completeScopeCache=task.catch(error=>{completeScopeCache=undefined;throw error})
  return task
}

export function buildVerifiedSunnahSearchScope(books:readonly StoredBook[]):SunnahSearchScope {const scoped=[] as SunnahSearchScope['books'],seen=new Set<string>();for(const book of books){if(!book.category||!VERIFIED_SUNNAH_CATEGORIES.has(book.category))continue;const sourceBookId=shamelaSourceBookId(book.id);/* السجل المحلي القديم/المستورد ليس سلطة نطاق: نتجاوزه ويعيد الكتالوج canonical إدخاله. */if(!sourceBookId||book.sourceKind!=='shamela4.1'||book.sourceBookId!==sourceBookId||seen.has(sourceBookId))continue;seen.add(sourceBookId);const rawAuthor=book.author?.trim(),knownAuthor=isKnownSunnahAuthorName(rawAuthor);scoped.push({publicId:shamelaPublicBookId(sourceBookId),sourceBookId,title:book.title,category:book.category,author:knownAuthor?rawAuthor!:'المؤلف مجهول',...(knownAuthor&&book.authorId?{authorId:book.authorId}:{}),...(knownAuthor&&book.deathYearHijri!=null&&book.deathYearHijri!==99999?{deathYearHijri:book.deathYearHijri}:{})})}return{contract:'sunnah-global-search-scope/1',books:scoped.sort((a,b)=>Number(a.sourceBookId)-Number(b.sourceBookId))}}
/** يكمل بطاقات قسم السنة من نطاق الكتالوج الموثق. قد يغيب سجل واحد من
 * IndexedDB لأن مصدره لا يذكر مؤلفًا؛ غياب المؤلف لا يسقط الكتاب من العد أو
 * التصفح، ويظل فتحه يمر بمسار جلب الكتاب الموثق نفسه. */
export function augmentSunnahLibraryBooks(books:readonly StoredBook[],scope:SunnahSearchScope):StoredBook[]{
  const existing=new Map<string,StoredBook>()
  for(const book of books){const sourceBookId=shamelaSourceBookId(book.id);if(sourceBookId)existing.set(sourceBookId,book)}
  return scope.books.map(meta=>{const local=existing.get(meta.sourceBookId);if(local){
    /* نطاق الكتالوج هو السلطة المنشورة للهوية. عالج سجل IndexedDB قديمًا
       مادام الكتالوج يملك اسمًا موثقًا، ولا تستبدل اسمًا معروفًا بمجهول. */
    if(isKnownSunnahAuthorName(meta.author))return{...local,author:meta.author,...(meta.authorId?{authorId:meta.authorId}:{}),...(meta.deathYearHijri!=null?{deathYearHijri:meta.deathYearHijri}:{})}
    return local
  }return({
    id:meta.publicId,sourceKind:'shamela4.1',sourceBookId:meta.sourceBookId,managedSource:'published',sourceFormat:'shamela-bok',
    title:meta.title,author:meta.author,...(meta.authorId?{authorId:meta.authorId}:{}),...(meta.deathYearHijri!=null?{deathYearHijri:meta.deathYearHijri}:{}),category:meta.category,fileName:`shamela4_1-${meta.sourceBookId}.catalog.json`,
    fileSize:0,addedAt:0,data:new Uint8Array(),mimeType:'application/vnd.alkhizana.shamela-catalog+json',
    originalSha256:`catalog-pending:${meta.sourceBookId}`,pdfStatus:'pending',
  } satisfies StoredBook)})
}
export async function searchAllVerifiedSunnahBooks(client:ShamelaSearchClient,scope:SunnahSearchScope,query:string,offset=0,limit=40,signal?:AbortSignal):Promise<SunnahGlobalSearchPage>{if(scope.contract!=='sunnah-global-search-scope/1'||!scope.books.length||scope.books.some(x=>!x.sourceBookId||!x.publicId))throw new Error('sunnah_search_scope_invalid');const compiled=compiledSunnahScope(scope),search=typeof client.searchExhaustiveV2==='function'?client.searchExhaustiveV2.bind(client):typeof client.searchCompleteV2==='function'?client.searchCompleteV2.bind(client):client.search.bind(client),page=signal?await search(query,offset,limit,compiled.publicIds,signal):await search(query,offset,limit,compiled.publicIds),reported=new Set([...page.unavailableBookIds,...page.pendingBookIds]);if([...reported].some(id=>!compiled.sourceIds.has(id)))throw new Error('sunnah_search_coverage_invalid');return{...page,scopeBooks:scope.books.length,scopeCoverageComplete:page.coverageComplete&&page.unavailableBookIds.length===0&&page.pendingBookIds.length===0}}

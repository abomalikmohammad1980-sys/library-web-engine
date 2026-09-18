/** فهرس النص الكامل للكتب — بحث في كل الكتب المحفوظة */

import { currentLibraryIdentityScope, getBook, listAuthorRecords, listBooks, listStoredBooks, type StoredBook } from './library_store'
import { inferBookFormat } from '../book_format'
import { storedTextSource, textParagraphs } from '../text_import'
import {localIndexKeys,localQueryCandidates} from './local_search_candidates'
import { searchAuthorChronology } from '../search_author_metadata'
import type { SearchContentScope } from '../search_content_scope'
import { createSearchYieldScheduler } from './search_yield'
import { shamelaSearchClient } from '../shamela_search_client'
import { shamelaPublicBookId, shamelaSourceBookId } from '../shamela_public_identity'
import { matchesSearchExclusions, parseAdvancedSearchQuery } from '../../../packages/search/src/index'
import {normalizeArabicSearch,normalizeArabicSearchWithMap} from './local_search_normalize'
import { type ShamelaAuthorIndex } from '../shamela_author_index'
import { loadShamelaAuthorMetadata } from '../shamela_author_metadata'
import { shamelaSearchMetadataKey } from '../shamela_search_metadata'
import { canonicalBookCategory, effectiveBookCategory } from '../taxonomy_links'
import { headingIndex } from './heading_index'
import {ensureCentralHeadingProvider} from '../central_heading_bootstrap'
import {localSearchBookFingerprint,orderedWordVolumes} from './word_volume_identity'
import { searchFieldReleaseBinding } from '../search_field_release'
import {publicBookSearchEnabled,searchPublicBooks} from '../public_book_search'

interface IndexedParagraph { index: number; text: string; volumeIndex?:number; sourceVolumeNumber?:number; sourceParagraphIndex?:number; pageLabel?:string; partLabel?:string; sectionHeading?:string }
interface LocalIndexedParagraph extends IndexedParagraph { normalizedText:string }
interface LocalIndexedBook { book:StoredBook; paragraphs:LocalIndexedParagraph[] }
interface LocalCandidate { book:StoredBook; paragraph:LocalIndexedParagraph }
interface StructuralCandidate { value:string; normalized:string; paragraphIndex?:number; pageIndex?:number; pageLabel?:string; partLabel?:string }
interface StructuralSearchDocument {
  authors:string[]
  tags:string[]
  fields:Array<[SearchField,StructuralCandidate[]]>
}
const paragraphCache = new Map<string, IndexedParagraph[]>()
// StoredBook records are immutable snapshots in the library store. Keeping this
// index by object identity avoids rebuilding and Arabic-normalising every card,
// category and TOC title for each keystroke; a replaced record gets a fresh entry.
const structuralSearchDocuments = new WeakMap<StoredBook,StructuralSearchDocument>()
const persistentLoads = new Map<string, Promise<IndexedParagraph[]>>()
const SEARCH_DB = 'alkhizana-search-index'
const SEARCH_STORE = 'paragraphs'
const SEARCH_VERSION = 1
interface NormalizedParagraphCache {version:'arabic-search/20260910-v1';texts:string[]}
interface PersistentIndexEntry { key: string; bookId: string; ownerScope?:string; fingerprint: string; paragraphs: IndexedParagraph[]; normalized?:NormalizedParagraphCache; updatedAt: number }
const NORMALIZED_PARAGRAPH_VERSION='arabic-search/20260910-v1' as const
const normalizedParagraphCache=new WeakMap<IndexedParagraph[],NormalizedParagraphCache>()
async function readyNormalizedParagraphs(rows:IndexedParagraph[],active:()=>void,saved?:NormalizedParagraphCache):Promise<NormalizedParagraphCache>{
  active();const cached=normalizedParagraphCache.get(rows)
  if(cached)return cached
  if(saved?.version===NORMALIZED_PARAGRAPH_VERSION&&Array.isArray(saved.texts)&&saved.texts.length===rows.length&&saved.texts.every(text=>typeof text==='string')){normalizedParagraphCache.set(rows,saved);return saved}
  const texts:string[]=[],scheduler=createSearchYieldScheduler(8,()=>performance.now(),()=>new Promise(resolve=>globalThis.setTimeout(resolve,0)))
  for(const row of rows){await scheduler.checkpoint();active();texts.push(normalizeArabicSearch(row.text))}
  active();const normalized={version:NORMALIZED_PARAGRAPH_VERSION,texts};normalizedParagraphCache.set(rows,normalized);return normalized
}
let searchDbPromise: Promise<IDBDatabase> | undefined
let localFederatedIndex:Promise<LocalIndexedBook[]>|undefined
let localFederatedReady=false
let localIndexFailed=false
const localFailedBookIds=new Set<string>()
const localFailedBooks=new Map<string,StoredBook>()
const localUnopenedBooks=new Map<string,StoredBook>()
let localIndexScope:string|undefined
let localIndexGeneration=0
let structuralSearchGeneration=0
let invalidateLocalIndex:(()=>void)|undefined
function ensureLocalIndexIdentity():void{
  const scope=currentLibraryIdentityScope()
  if(scope===localIndexScope)return
  localIndexScope=scope;localIndexGeneration++
  invalidateLocalIndex?.();invalidateLocalIndex=undefined
  localFederatedIndex=undefined;localFederatedReady=false;localIndexFailed=false
  localCandidateIndex.clear()
  localFailedBookIds.clear()
  localFailedBooks.clear()
  localUnopenedBooks.clear()
}
if(typeof window!=='undefined')window.addEventListener('alkhizana:account-changed',ensureLocalIndexIdentity)
function invalidateLocalSearchBooks():void{
  localIndexGeneration++;invalidateLocalIndex?.();invalidateLocalIndex=undefined
  localFederatedIndex=undefined;localFederatedReady=false;localIndexFailed=false
  localCandidateIndex.clear();localFailedBookIds.clear()
  localFailedBooks.clear()
  localUnopenedBooks.clear()
}
if(typeof window!=='undefined')window.addEventListener('library-changed',()=>{structuralSearchGeneration++;invalidateLocalSearchBooks()})
/** Explicit retry resets failed derived indexes, never the user's book data. */
export function retryFailedLocalSearchIndex():void{ensureLocalIndexIdentity();if(localIndexFailed)invalidateLocalSearchBooks()}
const localCandidateIndex=new Map<string,LocalCandidate[]>()
let fastAuthorIndex:ShamelaAuthorIndex|undefined
let fastAuthorIndexLoad:Promise<void>|undefined

function warmFastAuthorIndex():void{
  fastAuthorIndexLoad??=loadShamelaAuthorMetadata().then(index=>{fastAuthorIndex=index;globalThis.dispatchEvent?.(new Event('alkhizana:search-metadata-ready'))}).catch(()=>{fastAuthorIndexLoad=undefined})
}

/** Cancel this consumer, not the shared public metadata request. */
function waitForSearchMetadata(signal?:AbortSignal):Promise<void>{
  if(signal?.aborted)return Promise.reject(new DOMException('Search superseded','AbortError'))
  if(!signal)return fastAuthorIndexLoad??Promise.resolve()
  return new Promise<void>((resolve,reject)=>{
    const abort=()=>{signal.removeEventListener('abort',abort);reject(new DOMException('Search superseded','AbortError'))}
    signal.addEventListener('abort',abort,{once:true})
    Promise.resolve(fastAuthorIndexLoad).then(()=>{signal.removeEventListener('abort',abort);resolve()},error=>{signal.removeEventListener('abort',abort);reject(error)})
  })
}

async function localSearchIndex():Promise<LocalIndexedBook[]>{return localFederatedIndex??=(async()=>{
  const generation=localIndexGeneration,scope=localIndexScope
  // This bounds stalled progress, not total indexing time. Storage may finish
  // later, but invalidated work must never publish readiness or candidates.
  let valid=true
  const controller=new AbortController()
  const active=()=>{if(!valid||generation!==localIndexGeneration||scope!==currentLibraryIdentityScope())throw new Error('local_search_index_invalidated');progressAt=Date.now()}
  let progressAt=Date.now()
  let timer:ReturnType<typeof setTimeout>|undefined
  const deadline=new Promise<never>((_,reject)=>{
    invalidateLocalIndex=()=>{valid=false;controller.abort();reject(new Error('local_search_index_invalidated'))}
    const check=()=>{const remaining=30_000-(Date.now()-progressAt);if(remaining>0){timer=setTimeout(check,remaining);return}valid=false;controller.abort();reject(new Error('local_search_index_deadline'))}
    timer=setTimeout(check,30_000)
  })
  const work=(async()=>{
  // لا نبدأ استخراج Word/EPUB داخل microtask وصول نتيجة v2؛ فهذا كان يمنع
  // المتصفح من رسم النتيجة السريعة وحتى من تشغيل مؤقت الإلغاء. نعطي الرسم
  // دورة كاملة، ثم نفهرس كتابًا كتابًا مع yield محدود بين الكتب.
  await new Promise<void>(resolve=>globalThis.setTimeout(resolve,0))
  active()
  // Searching must not create author records for the entire public catalogue.
  // Existing records enrich local books; public chronology comes from metadata.
  const storedBooks=await listStoredBooks()
  active()
  const localBooks=storedBooks.filter(book=>book.sourceKind!=='shamela4.1'&&!shamelaSourceBookId(book.id))
  // Public-only catalogues have no local content to enrich. An unrelated
  // author-store stall must not turn their completed negative query into a
  // local indexing failure.
  const authorRecords=localBooks.length?await listAuthorRecords(false):[]
  active()
  const books=localBooks.map(book=>({...book,...searchAuthorChronology(book,authorRecords)}))
  const index:LocalIndexedBook[]=[]
  const scheduler=createSearchYieldScheduler(16,()=>performance.now(),()=>new Promise(resolve=>globalThis.setTimeout(resolve,0)))
  for(const book of books){
    await scheduler.checkpoint()
    active()
    if(book.managedSource==='published'&&!book.data?.byteLength){localUnopenedBooks.set(book.id,book);continue}
    let paragraphs:IndexedParagraph[]
    try{paragraphs=await persistentIndexedParagraphs(book,controller.signal,undefined,active)}catch(error){active();localFailedBookIds.add(book.id);localFailedBooks.set(book.id,book);continue}
    active()
    const normalized=await readyNormalizedParagraphs(paragraphs,active)
    const entry={book,paragraphs:paragraphs.map((paragraph,i)=>({...paragraph,normalizedText:normalized.texts[i]!}))}
    index.push(entry)
    for(const paragraph of entry.paragraphs){
      await scheduler.checkpoint()
      active()
      const candidate={book:entry.book,paragraph}
      for(const key of localIndexKeys(paragraph.normalizedText)){
        const bucket=localCandidateIndex.get(key)
        bucket?bucket.push(candidate):localCandidateIndex.set(key,[candidate])
      }
    }
  }
  active()
  localFederatedReady=true
  localIndexFailed=localFailedBookIds.size>0
  globalThis.dispatchEvent?.(new Event('alkhizana:local-search-index-ready'))
  return index
  })()
  try{return await Promise.race([work,deadline])}
  finally{valid=false;if(timer!==undefined)clearTimeout(timer);if(generation===localIndexGeneration)invalidateLocalIndex=undefined}
})()}

export interface SearchResult {
  publicUpload?:boolean
  volumeIndex?:number
  resultKey?: string
  bookId: string
  title: string
  author: string
  authors: string[]
  category?: string
  deathYearHijri?: number
  contemporary?: boolean
  tags: string[]
  /** رقم الفقرة المطابقة (0-based) */
  paraIndex: number
  /** 0-based physical reader page, only when resolved from an authoritative page id. */
  pageIndex?: number
  /** النص المحيط (مع سياق) */
  snippet: string
  /** النص الكامل للفقرة */
  matchText: string
  /** الحقل الذي أنتج المطابقة. */
  field: SearchField
  occurrenceCount?: number
  sourceKind?: StoredBook['sourceKind'] | 'shamela4.1'
  sectionHeading?: string
  pageLabel?: string
  partLabel?: string
}
export interface SearchResultSet extends Array<SearchResult> { localIndexFailed?:boolean; unavailableBookIds?:string[]; pendingBookIds?:string[]; unopenedBookIds?:string[]; headingIndexMissingBookIds?:string[]; coverageComplete?:boolean; totalOccurrences?:number; totalDocuments?:number }

export type SearchField = 'body' | 'heading' | 'tag' | 'category' | 'card'

export interface SearchQueryOptions {
  /** Applies to body-field content only; structural field searches retain their own scope. */
  contentScope?: SearchContentScope
  bookIds?: string[]
  authors?: string[]
  categories?: string[]
  deathFrom?: number
  deathTo?: number
  deathState?: 'pre-hijra' | 'contemporary'
  fields?: SearchField[]
  /** يلغي الطلب القديم فور بدء بحث أحدث في الواجهة. */
  signal?: AbortSignal
  /** إزاحة/حجم دفعة فهرس الشاملة للتمرير المتتابع. */
  resultOffset?: number
  resultLimit?: number
}

export interface ShamelaMetadataScope { bookIds?: string[]; coverageComplete: boolean }

/**
 * يبني تقاطع المرشحات قبل فتح شظايا النص. اكتمال فهرس المؤلفين يكفي
 * للمؤلف والوفاة، أما التصنيف فمصدره كتالوج الكتب؛ لذلك لا ندّعي اكتمال
 * التغطية إن كان الكتالوج المحمّل لا يغطي كل كتب فهرس الشاملة.
 */
export function shamelaMetadataScope(index: ShamelaAuthorIndex, options: SearchQueryOptions, storedBooks: readonly StoredBook[] = []): ShamelaMetadataScope {
  const active = Boolean(options.bookIds?.length || options.authors?.length || options.categories?.length || options.deathFrom || options.deathTo || options.deathState)
  if (!active) return { coverageComplete: true }
  let allowed: Set<string> | undefined
  const intersect = (values: Iterable<string>): void => {
    const next = new Set(values)
    allowed = allowed ? new Set([...allowed].filter(value => next.has(value))) : next
  }
  if (options.bookIds?.length) intersect(options.bookIds.map(shamelaSourceBookId).filter((value): value is string => Boolean(value)))
  if (options.authors?.length || options.deathFrom || options.deathTo || options.deathState) {
    intersect(index.authors.filter(author => {
      if (options.authors?.length && !options.authors.includes(author.name)) return false
      if (options.deathState === 'contemporary' && !author.contemporary) return false
      if (options.deathState === 'pre-hijra' && (author.contemporary || (author.deathYearHijri ?? 0) >= 1)) return false
      if (options.deathFrom && (author.contemporary || (author.deathYearHijri ?? 0) < options.deathFrom)) return false
      if (options.deathTo && (author.contemporary || (author.deathYearHijri ?? Number.POSITIVE_INFINITY) > options.deathTo)) return false
      return true
    }).flatMap(author => author.books.map(book => shamelaSearchMetadataKey(book.sourceBookId))))
  }
  let coverageComplete = true
  if (options.categories?.length) {
    const catalogSourceIds = new Set(storedBooks.map(book => book.sourceBookId ?? shamelaSourceBookId(book.id)).filter((value): value is string => Boolean(value)).map(shamelaSearchMetadataKey))
    const indexedSourceIds = index.authors.flatMap(author => author.books.map(book => shamelaSearchMetadataKey(book.sourceBookId)))
    coverageComplete = indexedSourceIds.every(sourceId => catalogSourceIds.has(sourceId))
    intersect(storedBooks.filter(book => {
    const sourceId = book.sourceBookId ?? shamelaSourceBookId(book.id)
    return Boolean(sourceId && options.categories!.map(canonicalBookCategory).includes(effectiveBookCategory(book)))
    }).map(book => shamelaSearchMetadataKey(book.sourceBookId ?? shamelaSourceBookId(book.id)!)))
  }
  return { bookIds: [...(allowed ?? [])], coverageComplete }
}

export function shamelaMetadataScopeBookIds(index: ShamelaAuthorIndex, options: SearchQueryOptions, storedBooks: readonly StoredBook[] = []): string[] | undefined {
  return shamelaMetadataScope(index, options, storedBooks).bookIds
}

function storedBookMatchesMetadata(book: StoredBook, options: SearchQueryOptions): boolean {
  if(publicBookSearchEnabled()&&book.id.startsWith('central-submission:'))return false
  const authors = book.authors?.length ? book.authors.map(author => author.name) : [book.author]
  if (options.bookIds?.length && !options.bookIds.includes(book.id)) return false
  if (options.authors?.length && !options.authors.some(author => authors.includes(author))) return false
  if (options.categories?.length && !options.categories.map(canonicalBookCategory).includes(effectiveBookCategory(book))) return false
  if (options.deathState === 'contemporary' && !book.contemporary) return false
  if (options.deathState === 'pre-hijra' && (book.contemporary || (book.deathYearHijri ?? 0) >= 1)) return false
  if (options.deathFrom && (book.contemporary || (book.deathYearHijri ?? 0) < options.deathFrom)) return false
  if (options.deathTo && (book.contemporary || (book.deathYearHijri ?? Number.POSITIVE_INFINITY) > options.deathTo)) return false
  return true
}

/** يفك بطاقة الشاملة البنيوية إلى قيم بشرية قابلة للعرض، ولا يعرض مفاتيح JSON الداخلية. */
export function sourceMetadataCardValues(raw:string|undefined):string[]{
  const value=raw?.trim()
  if(!value)return[]
  if(!/^[\[{]/u.test(value))return[value]
  try{
    const parsed:unknown=JSON.parse(value),values:string[]=[]
    const visit=(item:unknown):void=>{
      if(typeof item==='string'){
        const clean=item.replace(/\s+/gu,' ').trim()
        if(clean)values.push(clean)
        return
      }
      if(Array.isArray(item)){for(const child of item)visit(child);return}
      if(item&&typeof item==='object')for(const child of Object.values(item))visit(child)
    }
    visit(parsed)
    return[...new Set(values)]
  }catch{return[value]}
}

function structuralSearchDocument(book:StoredBook):StructuralSearchDocument{
  const cached=structuralSearchDocuments.get(book)
  if(cached&&cached.fields.find(([field])=>field==='category')?.[1][0]?.value===effectiveBookCategory(book))return cached
  const authors=book.authors?.length?book.authors.map(author=>author.name):[book.author]
  const tags=book.tags?.map(tag=>tag.name)??[]
  const candidate=(value:string,anchor:Pick<StructuralCandidate,'paragraphIndex'|'pageIndex'>={}):StructuralCandidate=>({value,normalized:normalizeArabicSearch(value),...anchor})
  const category=effectiveBookCategory(book)
  const fields:Array<[SearchField,StructuralCandidate[]]>=[
    ['tag',(book.tags?.filter(tag=>tag.source==='manual')??[]).map(tag=>candidate(tag.name))],
    ['category',[candidate(category)]],
    ['card',[book.description,book.publisher,book.investigator,book.edition,book.publicationYearHijri==null?undefined:String(book.publicationYearHijri),...sourceMetadataCardValues(book.rawSourceMetadata)].filter((value):value is string=>Boolean(value?.trim())).map(value=>candidate(value))],
  ]
  const document={authors,tags,fields}
  structuralSearchDocuments.set(book,document)
  return document
}

/** بحث في كل الكتب. يُرجع النتائج مرتبة حسب الملاءمة. */
export async function searchAllBooks(query: string, options: SearchQueryOptions = {}): Promise<SearchResultSet> {
 if(!publicBookSearchEnabled())return searchExistingBooks(query,options)
 const [existing,uploaded]=await Promise.all([searchExistingBooks(query,options),searchPublicBooks(query,options)])
 // Public uploads are authoritative server data, never stale cached copies.
 const result=existing.filter(row=>!row.bookId.startsWith('central-submission:')) as SearchResultSet
 Object.assign(result,{coverageComplete:existing.coverageComplete!==false&&uploaded.coverageComplete!==false,totalOccurrences:(existing.totalOccurrences??existing.length)+(uploaded.totalOccurrences??0),unavailableBookIds:existing.unavailableBookIds,pendingBookIds:existing.pendingBookIds,unopenedBookIds:existing.unopenedBookIds,headingIndexMissingBookIds:existing.headingIndexMissingBookIds,localIndexFailed:existing.localIndexFailed})
 if(existing.totalDocuments!==undefined)result.totalDocuments=existing.totalDocuments+(uploaded.totalDocuments??0)
 result.pendingBookIds=[...(existing.pendingBookIds??[]),...(uploaded.pendingBookIds??[])];result.unavailableBookIds=[...(existing.unavailableBookIds??[]),...(uploaded.unavailableBookIds??[])];result.push(...uploaded);sortSearchResultsByDeath(result);return result
}
async function searchExistingBooks(query: string, options: SearchQueryOptions = {}): Promise<SearchResultSet> {
  ensureLocalIndexIdentity()
  const searchGeneration=localIndexGeneration,structuralGeneration=structuralSearchGeneration,searchScope=localIndexScope
  // Preparing derived body indexes must not cancel independent TOC/metadata
  // reads. Actual library changes and account switches still invalidate both.
  const searchesBody=(options.fields??['body']).includes('body')
  const active = (): void => { if (options.signal?.aborted||(searchesBody?searchGeneration!==localIndexGeneration:structuralGeneration!==structuralSearchGeneration)||searchScope!==currentLibraryIdentityScope()) throw new DOMException('Search superseded', 'AbortError') }
  active()
  const expression=parseAdvancedSearchQuery(query)
  const q = expression.query.trim()
  if (!q || q.length < 2) return []
  const normalizedQuery = normalizeArabicSearch(q)

  const fields = new Set<SearchField>(options.fields ?? ['body', 'heading', 'tag', 'category', 'card'])
  // Only an explicit, wholly local selection has verified structural sources.
  // Global, unknown and central selections remain closed until the overlay exists.
  if(fields.has('body')&&options.contentScope&&options.contentScope!=='both'){
    const release=searchFieldReleaseBinding()
    if((!release&&!options.bookIds?.length)||!['body','foot'].includes(options.contentScope))throw new Error('search_content_scope_index_unavailable')
    const stored=await listStoredBooks();active()
    const byId=new Map(stored.map(book=>[book.id,book])),selected=[...new Set(options.bookIds?.length?options.bookIds:stored.map(book=>book.id))]
    if(selected.some(id=>{const book=byId.get(id);return release?!book&&!shamelaSourceBookId(id):!book||book.sourceKind==='shamela4.1'||Boolean(shamelaSourceBookId(id))}))throw new Error('search_content_scope_index_unavailable')
    const [{scopedContentIndex},{matchScopedContent},authorRecords]=await Promise.all([import('./scoped_content_index'),import('./scoped_content_matches'),listAuthorRecords(false)]);active()
    const result:SearchResultSet=[],unavailable:string[]=[]
    let totalOccurrences=0
    const scheduler=createSearchYieldScheduler()
    for(const id of selected){
      await scheduler.checkpoint();active()
      if(shamelaSourceBookId(id)||byId.get(id)?.sourceKind==='shamela4.1')continue
      const original=byId.get(id)!,book={...original,...searchAuthorChronology(original,authorRecords)}
      if(!storedBookMatchesMetadata(book,options))continue
      try{
        const content=await scopedContentIndex(book,options.contentScope,options.signal);active()
        const found=matchScopedContent(content,q,options.signal);active()
        if(!found.complete)unavailable.push(book.id)
        for(const match of found.matches){
          active()
          if(matchesSearchExclusions(match.text,expression.excluded))continue
          totalOccurrences+=match.occurrenceCount
          const start=Math.max(0,match.firstMatchStart-90),end=Math.min(match.text.length,match.firstMatchEnd+150)
          result.push({resultKey:JSON.stringify(['local-content',searchScope,options.contentScope,book.id,match.segmentKey]),bookId:book.id,title:book.title,author:book.author,authors:book.authors?.map(author=>author.name)??[book.author],tags:book.tags?.map(tag=>tag.name)??[],category:effectiveBookCategory(book),...searchAuthorChronology(book,authorRecords),paraIndex:match.anchorIndex??-1,snippet:`${start?'…':''}${match.text.slice(start,end)}${end<match.text.length?'…':''}`,matchText:match.text,field:'body',occurrenceCount:match.occurrenceCount,sourceKind:book.sourceKind})
        }
      }catch(error){active();unavailable.push(book.id)}
    }
    const offset=Math.max(0,Math.floor(options.resultOffset??0)),limit=Math.max(1,Math.min(500,Math.floor(options.resultLimit??40)))
    let totalDocuments=result.length,remoteCoverage=true
    if(release&&(!options.bookIds?.length||options.bookIds.some(id=>Boolean(shamelaSourceBookId(id))))){
      warmFastAuthorIndex();await waitForSearchMetadata(options.signal);active()
      if(!fastAuthorIndex)throw new Error('search_metadata_unavailable')
      const catalog=options.categories?.length?await listBooks({requireCompleteCatalog:true}):[];active()
      const scope=shamelaMetadataScope(fastAuthorIndex,options,catalog)
      remoteCoverage=scope.coverageComplete
      const names=new Map(fastAuthorIndex.authors.flatMap(author=>author.books.map(book=>[shamelaSearchMetadataKey(book.sourceBookId),{title:book.title,author:author.name,deathYearHijri:author.deathYearHijri}] as const)))
      if(scope.bookIds?.length!==0){
        let remoteOffset=0,remoteTotal=Infinity
        // Read only the central prefix needed to merge this page with local
        // matches. Exclusions require the full scoped stream before counting.
        while(remoteOffset<remoteTotal&&(expression.excluded.length>0||remoteOffset<offset+limit)){
          const remote=await shamelaSearchClient().searchSeparatedV2(q,options.contentScope,release,remoteOffset,Math.min(500,expression.excluded.length?500:offset+limit-remoteOffset),scope.bookIds?.map(shamelaPublicBookId),options.signal);active()
          remoteTotal=remote.totalDocuments
          if(remoteOffset===0&&!expression.excluded.length){totalDocuments+=remote.totalDocuments;totalOccurrences+=remote.totalOccurrences}
          if(!remote.coverageComplete)throw Error('search_field_coverage_incomplete')
          if(!remote.hits.length&&remoteOffset<remoteTotal)throw Error('search_field_page_incomplete')
          for(const hit of remote.hits){
            if(matchesSearchExclusions(hit.text,expression.excluded))continue
            const sourceId=shamelaSearchMetadataKey(hit.bookId),meta=names.get(sourceId)
            if(!meta)throw Error('search_metadata_unavailable')
            const start=Math.max(0,hit.matchOffset-90),end=Math.min(hit.text.length,hit.matchOffset+q.length+170)
            const occurrenceCount=hit.occurrenceCount??1
            if(expression.excluded.length){totalDocuments++;totalOccurrences+=occurrenceCount}
            const deathYearHijri=hit.deathYearHijri??meta.deathYearHijri
            result.push({bookId:shamelaPublicBookId(sourceId),title:meta.title,author:hit.author?.trim()||meta.author,authors:[hit.author?.trim()||meta.author],tags:[],...(deathYearHijri===undefined?{}:{deathYearHijri}),paraIndex:hit.paragraphIndex,snippet:`${start?'…':''}${hit.text.slice(start,end)}${end<hit.text.length?'…':''}`,matchText:hit.text,field:'body',occurrenceCount,sourceKind:'shamela4.1',...(hit.pageLabel?{pageLabel:hit.pageLabel}:{}),...(hit.partLabel?{partLabel:hit.partLabel}:{}),...(hit.sectionHeading?{sectionHeading:hit.sectionHeading}:{})})
          }
          remoteOffset+=remote.hits.length
        }
      }
    }
    active();sortSearchResultsByDeath(result)
    const page=result.slice(offset,offset+limit) as SearchResultSet
    page.totalOccurrences=totalOccurrences;page.totalDocuments=totalDocuments;page.coverageComplete=remoteCoverage&&unavailable.length===0;page.unavailableBookIds=[...new Set(unavailable)];page.pendingBookIds=[]
    return page
  }
  // Heading release and catalog metadata are independent reads. Start them
  // together instead of adding catalog latency after every cold bootstrap.
  const headingPreparation=fields.has('heading')&&!fields.has('body')?await Promise.all([
    ensureCentralHeadingProvider(options.signal),listBooks(),listAuthorRecords(false),
  ]):undefined
  const central=headingPreparation?.[0]
  const metadataFiltered=Boolean(options.bookIds?.length||options.authors?.length||options.categories?.length||options.deathFrom||options.deathTo||options.deathState)
  if(fields.has('body')){
    const searchStarted=performance.now(),phase=(name:string)=>{if(globalThis.location?.hostname==='localhost'||globalThis.location?.hostname==='127.0.0.1')console.debug(`search_store_phase ${JSON.stringify({name,ms:Math.round(performance.now()-searchStarted)})}`)}
    const resultOffset=Math.max(0,options.resultOffset??0),resultLimit=Math.max(1,Math.min(500,options.resultLimit??40))
    // لا تحتاج النتيجة السلبية غير المفلترة إلى تنزيل بيانات أسماء الكتب.
    // النطاق المفلتر يحتاجها قبل البحث، والموجب ينتظر الأسماء قبل عرضه.
    if(metadataFiltered)warmFastAuthorIndex()
    const hasExclusions=expression.excluded.length>0
    // Scope filters require metadata before routing. An unfiltered negative
    // result needs no titles: start v2 concurrently, without this dependency.
    if(metadataFiltered){await waitForSearchMetadata(options.signal);if(!fastAuthorIndex)throw new Error('search_metadata_unavailable')}
    active();phase('metadata-index')
    const scopeBooks = metadataFiltered ? await listBooks({requireCompleteCatalog:true}) : []
    const metadataScope = fastAuthorIndex ? shamelaMetadataScope(fastAuthorIndex, options, scopeBooks) : { coverageComplete: !metadataFiltered }
    const scopedSourceIds = metadataScope.bookIds
    // Start local preparation alongside the remote request, not after it. The
    // local task yields before extraction and between books; query cancellation
    // does not discard shared work, but identity/generation changes still do.
    if(!localFederatedReady&&!localIndexFailed)void localSearchIndex().catch(()=>{
      if(searchGeneration!==localIndexGeneration||searchScope!==currentLibraryIdentityScope())return
      if(localIndexFailed)return
      localIndexFailed=true
      localCandidateIndex.clear()
      globalThis.dispatchEvent?.(new Event('alkhizana:local-search-index-failed'))
    })
    const rawPage=scopedSourceIds?.length===0?{total:0,offset:resultOffset,limit:resultLimit,hits:[],unavailableBookIds:[],pendingBookIds:[],coverageComplete:true}:await shamelaSearchClient().searchCompleteV2(q,hasExclusions?0:resultOffset,hasExclusions?500:resultLimit,scopedSourceIds?.map(shamelaPublicBookId),options.signal);phase('v2');active()
    // Positive hits still need verified titles; do not publish numeric or
    // guessed book names. UI cancellation also interrupts this final wait.
    if(!metadataFiltered&&rawPage.hits.length){warmFastAuthorIndex();await waitForSearchMetadata(options.signal);if(!fastAuthorIndex)throw new Error('search_metadata_unavailable')}
    active();phase('metadata-titles')
    const acceptedHits=hasExclusions?rawPage.hits.filter(hit=>!matchesSearchExclusions([hit.text,hit.author,hit.sectionHeading].filter(Boolean).join(' '),expression.excluded)):rawPage.hits
    const page={...rawPage,hits:hasExclusions?acceptedHits.slice(resultOffset,resultOffset+resultLimit):acceptedHits,total:hasExclusions?acceptedHits.length:rawPage.total}
    // تجهيز الصيغ المحلية يعمل بالتوازي؛ ندمج الجاهز الآن دون انتظار الباقي.
    // أسماء النتائج موثقة أعلاه، وأحداث الجاهزية تدمج النتائج المحلية اللاحقة.
    const books=new Map((fastAuthorIndex?.authors??[]).flatMap(author=>author.books.map(book=>[shamelaSearchMetadataKey(book.sourceBookId),{title:book.title,author:author.name,deathYearHijri:author.deathYearHijri}] as const)));phase('metadata-map')
    const grouped=new Map<string,{hit:(typeof page.hits)[number];count:number}>();for(const hit of page.hits){const current=grouped.get(hit.id),count=hit.occurrenceCount??1;current?current.count+=count:grouped.set(hit.id,{hit,count})}
    const fastResults=[...grouped.values()].map(({hit,count:occurrenceCount})=>{const sourceBookId=shamelaSearchMetadataKey(hit.bookId),book=books.get(sourceBookId),deathYearHijri=hit.deathYearHijri??book?.deathYearHijri,start=Math.max(0,hit.matchOffset-90),end=Math.min(hit.text.length,hit.matchOffset+q.length+170),author=hit.author?.trim()||book?.author?.trim()||'المؤلف مجهول';return{bookId:shamelaPublicBookId(sourceBookId),title:book?.title??'عنوان الكتاب غير متاح',author,authors:[author],...(deathYearHijri!=null?{deathYearHijri}:{}),tags:[],paraIndex:hit.paragraphIndex,snippet:`${start?'…':''}${hit.text.slice(start,end)}${end<hit.text.length?'…':''}`,matchText:hit.text,field:'body' as const,occurrenceCount,...(hit.pageLabel?{pageLabel:hit.pageLabel}:{}),...(hit.partLabel?{partLabel:hit.partLabel}:{}),...(hit.sectionHeading?{sectionHeading:hit.sectionHeading}:{})}})
    const localResults:SearchResult[]=[];let localOccurrences=0;if(localFederatedReady){for(const {book:localBook,paragraph} of localQueryCandidates(localCandidateIndex,normalizedQuery)){active();if(!storedBookMatchesMetadata(localBook,options)||!paragraph.normalizedText.includes(normalizedQuery)||matchesSearchExclusions(paragraph.text,expression.excluded))continue;let occurrenceCount=0,offset=0;while((offset=paragraph.normalizedText.indexOf(normalizedQuery,offset))!==-1){occurrenceCount++;offset+=Math.max(1,normalizedQuery.length)}localOccurrences+=occurrenceCount;const mapped=normalizeArabicSearchWithMap(paragraph.text),match=mapped.text.indexOf(normalizedQuery),originalStart=mapped.originalOffsets[Math.max(0,match)]??0,originalEnd=(mapped.originalOffsets[Math.max(0,match+normalizedQuery.length-1)]??originalStart)+1,start=Math.max(0,originalStart-90),end=Math.min(paragraph.text.length,originalEnd+150);localResults.push({...(paragraph.volumeIndex===undefined?{}:{volumeIndex:paragraph.volumeIndex,resultKey:JSON.stringify(['local-volume',searchScope,localBook.id,paragraph.volumeIndex,paragraph.index]),partLabel:paragraph.partLabel}),bookId:localBook.id,title:localBook.title,author:localBook.author,authors:localBook.authors?.map(x=>x.name)??[localBook.author],...(localBook.deathYearHijri!=null?{deathYearHijri:localBook.deathYearHijri}:{}),...(localBook.contemporary!=null?{contemporary:localBook.contemporary}:{}),tags:localBook.tags?.map(x=>x.name)??[],paraIndex:paragraph.index,snippet:`${start?'…':''}${paragraph.text.slice(start,end)}${end<paragraph.text.length?'…':''}`,matchText:paragraph.text,field:'body',occurrenceCount,sourceKind:localBook.sourceKind,...(paragraph.pageLabel?{pageLabel:paragraph.pageLabel}:{}),...(paragraph.sectionHeading?{sectionHeading:paragraph.sectionHeading}:{})})}}phase('local-query')
    const scopedFailedIds=[...localFailedBookIds].filter(id=>{const book=localFailedBooks.get(id);return !book||storedBookMatchesMetadata(book,options)})
    const scopedIndexFailed=localIndexFailed&&(localFailedBookIds.size===0||scopedFailedIds.length>0)
    const unopened=[...localUnopenedBooks.values()].filter(book=>storedBookMatchesMetadata(book,options)).map(book=>book.id)
    const result=[...localResults,...fastResults.map(hit=>({...hit,sourceKind:'shamela4.1' as const}))] as SearchResultSet;result.totalOccurrences=page.total+localOccurrences;if(page.totalDocuments!==undefined&&!hasExclusions)result.totalDocuments=page.totalDocuments+localResults.length;result.unavailableBookIds=[...(page.unavailableBookIds??[]),...scopedFailedIds];result.unopenedBookIds=unopened;result.pendingBookIds=localFederatedReady||localIndexFailed?page.pendingBookIds:[...(page.pendingBookIds??[]),'local-formats'];result.localIndexFailed=scopedIndexFailed;result.coverageComplete=page.coverageComplete&&metadataScope.coverageComplete&&localFederatedReady&&!scopedIndexFailed&&unopened.length===0;sortSearchResultsByDeath(result);return result
  }
  const [allBooks, authorRecords] = headingPreparation
    ? [headingPreparation[1],headingPreparation[2]]
    : await Promise.all([listBooks(), listAuthorRecords(false)])
  const books = allBooks.filter(book => storedBookMatchesMetadata(book,options)).filter(book => !fields.has('body') || book.sourceKind!=='shamela4.1'&&!shamelaSourceBookId(book.id))
  void cleanRemovedBookIndexes(new Set(allBooks.map(book => book.id)))
  const results: SearchResultSet = []
  const scheduler = createSearchYieldScheduler()

  for (const book of books) {
    active()
    // These headings are searched by the verified central provider below.
    // Do not normalize every book's unrelated metadata card on each query.
    // Mixed-field searches and local/uncovered TOCs still use the normal path.
    if(fields.size===1&&fields.has('heading')&&central?.coveredBookIds.has(book.id))continue
    // نحافظ على استجابة الواجهة بميزانية زمنية، لا بمؤقت لكل كتاب. المؤقت لكل
    // كتاب كان يضيف حدًا أدنى ضخمًا للزمن عند فهرسة كتالوج الشاملة كاملًا.
    await scheduler.checkpoint()
    const {authors,tags,fields:cachedFields}=structuralSearchDocument(book)
    const structuralFields=[...cachedFields]
    if(fields.has('heading')&&!fields.has('body')&&!central?.coveredBookIds.has(book.id)){
      const headings=await headingIndex(book)
      active()
      structuralFields.push(['heading',headings.entries.map(entry=>({...entry,normalized:normalizeArabicSearch(entry.value)}))])
      if(!headings.complete){(results.headingIndexMissingBookIds??=[]).push(book.id);results.coverageComplete=false}
    }
    for (const [field, candidates] of structuralFields) {
      if (field === 'heading' && fields.has('body')) continue
      if (!fields.has(field)) continue
      const matches=candidates.filter(item=>item.value&&item.normalized.includes(normalizedQuery)&&!matchesSearchExclusions(item.value,expression.excluded))
      if(!matches.length)continue
      const metadata = { authors, tags, category: effectiveBookCategory(book), ...searchAuthorChronology(book, authorRecords) }
      for(const candidate of field==='heading'?matches:matches.slice(0,1))results.push({ bookId: book.id, title: book.title, author: book.author, ...metadata, paraIndex: candidate.paragraphIndex??-1, ...(candidate.pageIndex===undefined?{}:{pageIndex:candidate.pageIndex}), snippet: candidate.value, matchText: candidate.value, field, ...(field==='heading'?{sectionHeading:candidate.value,...(candidate.pageLabel?{pageLabel:candidate.pageLabel}:{}),...(candidate.partLabel?{partLabel:candidate.partLabel}:{})}:{}) })
    }
    if (!fields.has('body')) continue
    const metadata = { authors, tags, category: effectiveBookCategory(book), ...searchAuthorChronology(book, authorRecords) }
    let bookParagraphs:IndexedParagraph[]
    try{bookParagraphs=await persistentIndexedParagraphs(book,options.signal)}catch(error){
      if(options.signal?.aborted)throw error
      if(!(error instanceof Error)||!error.message.startsWith('local_search_text_unavailable:'))throw error
      results.coverageComplete=false;(results.unavailableBookIds??=[]).push(book.id);continue
    }
    for (const p of bookParagraphs) {
      const normalized=normalizeArabicSearchWithMap(p.text),idx = normalized.text.indexOf(normalizedQuery)
      if (idx === -1 || matchesSearchExclusions(p.text,expression.excluded)) continue

      // سياق: 40 حرفًا قبل وبعد
      const originalStart=normalized.originalOffsets[idx]??0,originalEnd=(normalized.originalOffsets[idx+normalizedQuery.length-1]??originalStart)+1
      const start = Math.max(0, originalStart - 40)
      const end = Math.min(p.text.length, originalEnd + 40)
      const snippet = (start > 0 ? '…' : '') + p.text.slice(start, end) + (end < p.text.length ? '…' : '')

      results.push({
        bookId: book.id,
        title: book.title,
        author: book.author,
        ...metadata,
        paraIndex: p.index,
        snippet,
        matchText: p.text,
        field: 'body',
        ...(p.pageLabel ? { pageLabel: p.pageLabel } : {}),
        ...(p.partLabel ? { partLabel: p.partLabel } : {}),
        ...(p.sectionHeading ? { sectionHeading: p.sectionHeading } : {}),
      })
    }
  }

  if (fields.has('body')) {
    const shamelaBooks=allBooks.filter(book=>book.sourceKind==='shamela4.1'||Boolean(shamelaSourceBookId(book.id))).filter(book=>!options.bookIds?.length||options.bookIds.includes(book.id))
    if(shamelaBooks.length){try{const bySourceId=new Map(shamelaBooks.map(book=>[book.sourceBookId??shamelaSourceBookId(book.id),book]));const page=await shamelaSearchClient().search(q,0,40,options.bookIds?.length?shamelaBooks.map(x=>x.id):undefined,options.signal);results.unavailableBookIds=page.unavailableBookIds.map(sourceId=>bySourceId.get(sourceId)?.id??sourceId);results.pendingBookIds=page.pendingBookIds.map(sourceId=>bySourceId.get(sourceId)?.id??sourceId);results.coverageComplete=page.coverageComplete;for(const hit of page.hits){const book=bySourceId.get(hit.bookId);if(!book)continue;const author=hit.author??book.author,authors=book.authors?.length?book.authors.map(x=>x.name):[author],chronology=searchAuthorChronology(book,authorRecords),deathYearHijri=hit.deathYearHijri??chronology.deathYearHijri;const start=Math.max(0,hit.matchOffset-40),end=Math.min(hit.text.length,hit.matchOffset+q.length+40);results.push({bookId:book.id,title:book.title,author,authors,category:effectiveBookCategory(book),...(deathYearHijri!=null?{deathYearHijri}:{}),tags:book.tags?.map(x=>x.name)??[],paraIndex:hit.paragraphIndex,snippet:`${start?'…':''}${hit.text.slice(start,end)}${end<hit.text.length?'…':''}`,matchText:hit.text,field:'body',...(hit.pageLabel?{pageLabel:hit.pageLabel}:{}),...(hit.partLabel?{partLabel:hit.partLabel}:{}),...(hit.sectionHeading?{sectionHeading:hit.sectionHeading}:{})})}}catch(error){if(options.signal?.aborted)throw error;results.unavailableBookIds=shamelaBooks.map(book=>book.id);console.warn('shamela_search_partial_unavailable',error)}}
  }

  // قرار المنتج: الوفاة تصاعديًا، والمجهول أخيرًا. Array.sort مستقر للتعادل.
  if(fields.has('heading')&&!fields.has('body'))results.coverageComplete=!(results.headingIndexMissingBookIds?.length)
  sortSearchResultsByDeath(results)

  if(central){
    const offset=Math.max(0,options.resultOffset??0),limit=Math.max(1,Math.min(500,options.resultLimit??40))
    const scoped=books.filter(book=>central.coveredBookIds.has(book.id)),byId=new Map(scoped.map(book=>[book.id,book]))
    const wholeCentralScope=!metadataFiltered&&scoped.length===central.coveredBookIds.size
    const localCount=results.length,localPage=results.slice(offset,offset+limit),remoteOffset=Math.max(0,offset-localCount)
    const page=scoped.length?await central.client.search(q,{offset:remoteOffset,limit:Math.max(1,limit-localPage.length),...(wholeCentralScope?{}:{bookIds:scoped.map(book=>{const sourceId=shamelaSourceBookId(book.id);if(!sourceId)throw new Error('heading_search_public_identity');return sourceId})}),excluded:expression.excluded,...(options.signal?{signal:options.signal}:{})}):{hits:[],total:0,coverageComplete:true}
    active()
    const remote=localPage.length===limit?[]:page.hits.map(hit=>{
      const book=byId.get(shamelaPublicBookId(hit.bookId))
      if(!book)throw new Error('heading_search_scope_integrity')
      return {resultKey:`heading:${central.releaseId}:${hit.bookId}:${hit.titleId}`,bookId:book.id,title:book.title,author:book.author,authors:book.authors?.map(author=>author.name)??[book.author],tags:book.tags?.map(tag=>tag.name)??[],category:effectiveBookCategory(book),...searchAuthorChronology(book,authorRecords),paraIndex:-1,...(hit.pageIndex===null?{}:{pageIndex:hit.pageIndex}),snippet:hit.title,matchText:hit.title,sectionHeading:hit.title,field:'heading' as const,sourceKind:'shamela4.1' as const,...(hit.pageLabel?{pageLabel:hit.pageLabel}:{}),...(hit.partLabel?{partLabel:hit.partLabel}:{})}
    })
    const combined=[...localPage,...remote] as SearchResultSet
    combined.totalOccurrences=localCount+page.total
    const availableIds=new Set(allBooks.map(book=>book.id))
    combined.coverageComplete=results.coverageComplete!==false&&page.coverageComplete&&[...central.coveredBookIds].every(id=>availableIds.has(id))
    if(results.headingIndexMissingBookIds)combined.headingIndexMissingBookIds=results.headingIndexMissingBookIds
    return combined
  }

  return results
}

export function sortSearchResultsByDeath<T extends {deathYearHijri?:number}>(results:T[]):T[]{return results.sort((a,b)=>(a.deathYearHijri??Number.POSITIVE_INFINITY)-(b.deathYearHijri??Number.POSITIVE_INFINITY))}

function paragraphOwner(book:StoredBook):{scope:string;active:()=>void}{
  const identity=currentLibraryIdentityScope(),publicBook=book.managedSource==='published'
  const active=()=>{if(currentLibraryIdentityScope()!==identity||(!publicBook&&(book.ownerScope?book.ownerScope!==identity:identity.startsWith('user:'))))throw Error('search_index_identity_changed')}
  active()
  const scope=publicBook?'public':identity
  return {scope,active}
}
async function paragraphIdentity(book:StoredBook):Promise<{scope:string;key:string;fingerprint:string;active:()=>void}>{
  const {scope,active}=paragraphOwner(book)
  const fingerprint=await localSearchBookFingerprint(book);active()
  return {scope,key:JSON.stringify([scope,book.id,fingerprint]),fingerprint,active}
}

/** Read-only readiness probe; never extracts content or copies another identity's cache. */
export async function isLocalBookSearchIndexReady(book:StoredBook):Promise<boolean>{
  if(localSearchTextUnavailable(book))return false
  const identity=await paragraphIdentity(book),fingerprint=identity.fingerprint
  if(paragraphCache.has(identity.key))return true
  if(typeof indexedDB==='undefined')return false
  try{const db=await openSearchDb();identity.active();const entry=await idbRequest<PersistentIndexEntry|undefined>(db.transaction(SEARCH_STORE,'readonly').objectStore(SEARCH_STORE).get(identity.key));identity.active();return entry?.ownerScope===identity.scope&&entry.fingerprint===fingerprint&&Array.isArray(entry.paragraphs)}catch{identity.active();return false}
}

export async function prepareLocalBookSearchIndex(bookId:string,options:{signal?:AbortSignal}={}):Promise<IndexedParagraph[]>{
  const scope=currentLibraryIdentityScope()
  const active=()=>{if(options.signal?.aborted||currentLibraryIdentityScope()!==scope)throw new DOMException('Local index cancelled','AbortError')}
  active();let book=await getBook(bookId);active()
  if(!book||book.sourceKind==='shamela4.1'||shamelaSourceBookId(book.id))throw Error('local_search_book_unavailable')
  // Catalog cards may contain metadata only. Download the verified published
  // asset before fingerprinting/indexing, just as opening the reader does.
  if(book.managedSource==='published'&&inferBookFormat(book)==='word'&&(!book.data?.byteLength||(book.fileSize>0&&book.data.byteLength!==book.fileSize))){
    const {ensurePublishedWorkSeeded}=await import('../published_library_seed')
    active();book=await ensurePublishedWorkSeeded(bookId);active()
    if(!book?.data?.byteLength||(book.fileSize>0&&book.data.byteLength!==book.fileSize))throw Error('local_search_source_unavailable')
  }
  const identity=await paragraphIdentity(book);identity.active()
  const fingerprint=identity.fingerprint
  const revisionActive=async()=>{active();const current=await getBook(bookId);active();if(!current||await localSearchBookFingerprint(current)!==fingerprint)throw Error('local_search_book_changed');active();paragraphOwner(current).active()}
  let paragraphs:IndexedParagraph[]
  try{paragraphs=await persistentIndexedParagraphs(book,options.signal,revisionActive)}catch(error){active();throw error}
  await revisionActive()
  active()
  ensureLocalIndexIdentity();invalidateLocalSearchBooks()
  globalThis.dispatchEvent?.(new Event('alkhizana:local-search-index-ready'))
  return paragraphs
}

export async function persistentIndexedParagraphs(book: StoredBook,signal?:AbortSignal,beforeCommit?:()=>Promise<void>,onProgress?:()=>void): Promise<IndexedParagraph[]> {
  assertLocalSearchTextAvailable(book)
  const identity=await paragraphIdentity(book)
  const activeIdentity=identity.active;identity.active=()=>{if(signal?.aborted)throw new DOMException('Local index cancelled','AbortError');activeIdentity();onProgress?.()};identity.active()
  const fingerprint = identity.fingerprint
  const key = identity.key
  const memory = paragraphCache.get(key)
  if (memory) {await beforeCommit?.();identity.active();const rows=inferBookFormat(book)==='word'&&!(book.volumes&&book.volumes.length>1)?alignWordSearchParagraphs(memory,book.wordPageMap):memory;await readyNormalizedParagraphs(rows,identity.active,await readyNormalizedParagraphs(memory,identity.active));return rows}
  const active = persistentLoads.get(key)
  if (active) { const paragraphs=await active;await beforeCommit?.();identity.active();return paragraphs }
  const load = (async () => {
    if (typeof indexedDB === 'undefined') {const rows=await indexedParagraphs(book,signal,beforeCommit);await readyNormalizedParagraphs(rows,identity.active);return rows}
    let extractionStarted=false
    try {
      const db = await openSearchDb()
      identity.active()
      const stored = await idbRequest<PersistentIndexEntry | undefined>(db.transaction(SEARCH_STORE, 'readonly').objectStore(SEARCH_STORE).get(key))
      identity.active()
      if (stored?.ownerScope===identity.scope && stored?.fingerprint === fingerprint && Array.isArray(stored.paragraphs)) {
        await beforeCommit?.();identity.active()
        const paragraphs=inferBookFormat(book)==='word'&&!(book.volumes&&book.volumes.length>1)?alignWordSearchParagraphs(stored.paragraphs,book.wordPageMap):stored.paragraphs
        const normalized=await readyNormalizedParagraphs(paragraphs,identity.active,stored.normalized)
        await beforeCommit?.();identity.active()
        paragraphCache.set(key, paragraphs)
        // This upgrades an already readable index, not content readiness.
        // Quota errors or a stuck transaction must not trigger DOCX parsing or
        // block search. A bounded optional write may improve the next reload.
        if(stored.normalized!==normalized){void writePersistentIndex(db,{...stored,paragraphs,normalized,updatedAt:Date.now()},1000).catch(()=>{})}
        return paragraphs
      }
      extractionStarted=true
      const paragraphs = await indexedParagraphs(book,signal,beforeCommit)
      await beforeCommit?.()
      identity.active()
      const normalized=await readyNormalizedParagraphs(paragraphs,identity.active)
      await beforeCommit?.();identity.active()
      await writePersistentIndex(db, { key, ownerScope:identity.scope, bookId: book.id, fingerprint, paragraphs, normalized, updatedAt: Date.now() })
      identity.active()
      return paragraphs
    } catch(error) {
      identity.active()
      // A parse/worker failure is not an IDB failure: never parse the same
      // broken or timed-out document a second time as a storage fallback.
      if(extractionStarted&&!paragraphCache.has(key))throw error
      // امتلاء التخزين أو منع IndexedDB لا يعطل البحث؛ يبقى كاش الجلسة صالحًا.
      const rows=await indexedParagraphs(book,signal,beforeCommit);await readyNormalizedParagraphs(rows,identity.active);return rows
    }
  })().finally(() => persistentLoads.delete(key))
  persistentLoads.set(key, load)
  return load
}

function openSearchDb(): Promise<IDBDatabase> {
  searchDbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(SEARCH_DB, SEARCH_VERSION)
    request.onupgradeneeded = () => {
      if (request.result.objectStoreNames.contains(SEARCH_STORE)) return
      const store = request.result.createObjectStore(SEARCH_STORE, { keyPath: 'key' })
      store.createIndex('bookId', 'bookId', { unique: false })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return searchDbPromise
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
}

function writePersistentIndex(db: IDBDatabase, entry: PersistentIndexEntry, timeoutMs?:number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SEARCH_STORE, 'readwrite')
    let timer:ReturnType<typeof setTimeout>|undefined
    const finish=(error?:unknown)=>{if(timer!==undefined)clearTimeout(timer);if(error)reject(error);else resolve()}
    if(timeoutMs!==undefined)timer=setTimeout(()=>{try{tx.abort()}catch{}finish(new Error('search_cache_upgrade_timeout'))},timeoutMs)
    tx.oncomplete = () => finish()
    tx.onerror = () => finish(tx.error??new Error('search_cache_write_failed'))
    tx.onabort = () => finish(tx.error??new Error('search_cache_write_aborted'))
    try{
    const store = tx.objectStore(SEARCH_STORE)
    store.put(entry)
    const cursor = store.index('bookId').openCursor(IDBKeyRange.only(entry.bookId))
    cursor.onsuccess = () => {
      const value = cursor.result
      if (!value) return
      if (value.primaryKey !== entry.key && (value.value as PersistentIndexEntry).ownerScope===entry.ownerScope) value.delete()
      value.continue()
    }
    }catch(error){finish(error)}
  })
}

const cleanedPersistentScopes = new Set<string>()
async function cleanRemovedBookIndexes(activeBookIds: Set<string>): Promise<void> {
  const scope=currentLibraryIdentityScope()
  if (cleanedPersistentScopes.has(scope) || typeof indexedDB === 'undefined') return
  cleanedPersistentScopes.add(scope)
  try {
    const db = await openSearchDb()
    if(currentLibraryIdentityScope()!==scope)return
    const tx = db.transaction(SEARCH_STORE, 'readwrite')
    const cursor = tx.objectStore(SEARCH_STORE).openCursor()
    cursor.onsuccess = () => { const value = cursor.result; if (!value) return; const entry=value.value as PersistentIndexEntry; if (currentLibraryIdentityScope()===scope&&entry.ownerScope===scope&&!activeBookIds.has(entry.bookId)) value.delete(); value.continue() }
  } catch { /* التنظيف تحسيني ولا يمنع البحث. */ }
}

// Missing extraction is not a successful zero-result index. Check before cache
// access too, so older empty PDF/EPUB cache entries cannot claim coverage.
function localSearchTextUnavailable(book:StoredBook):string|undefined{
  const format=inferBookFormat(book)
  if(format==='pdf')return format // PDF text extraction/OCR is not implemented here.
  if(format==='epub'&&!book.extractedText?.trim())return format
  if(format==='shamela-bok'&&!book.bokPages?.some(page=>page.text.trim())&&!book.extractedText?.trim())return format
}
function assertLocalSearchTextAvailable(book:StoredBook):void{
  const format=localSearchTextUnavailable(book)
  if(format)throw Error(`local_search_text_unavailable:${format}`)
}
export async function indexedParagraphs(book: StoredBook,signal?:AbortSignal,beforeCommit?:()=>Promise<void>): Promise<IndexedParagraph[]> {
  assertLocalSearchTextAvailable(book)
  const identity = await paragraphIdentity(book), key = identity.key
  const cached = paragraphCache.get(key)
  if (cached) {await beforeCommit?.();identity.active();return cached}
  const format = inferBookFormat(book)
  if(format==='word'&&book.volumes&&book.volumes.length>1){
    const paragraphs:IndexedParagraph[]=[]
    const {extractLocalWordParagraphs}=await import('./local_docx_worker')
    for(const [volumeIndex,volume]of orderedWordVolumes(book).entries()){
      identity.active();if(signal?.aborted)throw new DOMException('Local index cancelled','AbortError')
      const rows=await extractLocalWordParagraphs(volume.data,signal,identity.active);identity.active()
      paragraphs.push(...alignWordSearchParagraphs(rows,volume.wordPageMap).map(row=>({...row,volumeIndex,sourceVolumeNumber:volume.number,partLabel:String(volume.number)})))
    }
    await beforeCommit?.();identity.active();if(signal?.aborted)throw new DOMException('Local index cancelled','AbortError')
    paragraphCache.set(key,paragraphs);return paragraphs
  }
  // Only an uncached Word book needs the parser. The asynchronous boundary must
  // not allow a former account's pending book to enter the new account's cache.
  const needsDocx = !['text', 'markdown', 'shamela-bok', 'epub', 'pdf'].includes(format)
  const extracted = needsDocx ? await (await import('./local_docx_worker')).extractLocalWordParagraphs(book.data,signal,identity.active) : undefined
  identity.active()
  if(signal?.aborted)throw new DOMException('Local index cancelled','AbortError')
  const paragraphs = format === 'text' || format === 'markdown'
    ? textParagraphs(storedTextSource(book.data,book.extractedText)).map((text, index) => ({ index, text }))
    : format === 'shamela-bok' && book.bokPages?.length
      ? indexedBokPages(book)
    : format === 'epub' || format === 'shamela-bok'
      ? textParagraphs(book.extractedText ?? '').map((text, index) => ({ index, text }))
    : format === 'pdf'
      ? []
      : alignWordSearchParagraphs(extracted!,book.wordPageMap)
  await beforeCommit?.();identity.active()
  if(signal?.aborted)throw new DOMException('Local index cancelled','AbortError')
  paragraphCache.set(key, paragraphs)
  return paragraphs
}

/** يحافظ البحث المحلي في BOK على إحداثيات الصفحة نفسها التي يفتحها القارئ. */
export function indexedBokPages(book: Pick<StoredBook, 'bokPages' | 'bokToc'>): IndexedParagraph[] {
  const headings = new Map<number, string>()
  for (const entry of book.bokToc ?? []) {
    const title = entry.title.trim()
    if (title) headings.set(entry.id, title)
  }
  let sectionHeading: string | undefined
  return (book.bokPages ?? []).map((page, index) => {
    sectionHeading = headings.get(page.id) ?? sectionHeading
    return {
      index,
      text: page.text,
      partLabel: String(page.part),
      pageLabel: String(page.page),
      ...(sectionHeading ? { sectionHeading } : {}),
    }
  })
}

/** يربط إحداثي نموذج القارئ بإحداثي Word المؤلف عبر تسلسل النص، لا عبر افتراض تساوي الفهرسين. */
export function alignWordSearchParagraphs(paragraphs:IndexedParagraph[],map:StoredBook['wordPageMap']):IndexedParagraph[]{
  if(!map?.paragraphs?.length)return paragraphs
  const authored=map.paragraphs,fold=(value:string)=>normalizeArabicSearch(value.replace(/[\u0000-\u001f]/gu,'').trim())
  let cursor=0,section:string|undefined
  return paragraphs.map(paragraph=>{const wanted=fold(paragraph.text);let match=-1;for(let i=cursor;i<Math.min(authored.length,cursor+48);i++){const candidate=authored[i]!,clean=candidate.text.replace(/[\u0000-\u001f]/gu,'').trim();if(candidate.text.includes('\u000e')&&clean.length<=120)section=clean;if(fold(candidate.text)===wanted){match=i;break}}if(match<0)return paragraph;cursor=match+1;const source=authored[match]!;return{...paragraph,sourceParagraphIndex:source.paragraphIndex,pageLabel:String(source.adjustedPage),...(section?{sectionHeading:section}:{})}})
}

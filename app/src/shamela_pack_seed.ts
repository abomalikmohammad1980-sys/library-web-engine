import {isPlaceholderShamelaTitle,verifiedShamelaTitle,isUnknownShamelaAuthor,UNKNOWN_SHAMELA_AUTHOR} from './shamela_pack_materialize'
export {materializeShamelaPackBook,isPlaceholderShamelaTitle,verifiedShamelaTitle,isUnknownShamelaAuthor,UNKNOWN_SHAMELA_AUTHOR} from './shamela_pack_materialize'
import {prepareShamelaPackBook} from './shamela_pack_prepare'
import { deterministicCoverHue, deterministicCoverTemplate } from './book_cover'
import { cleanShamelaPlainText, parseShamelaStructuralText, remapShamelaPlainTextOffset } from './shamela_text_presentation'
import { getBook, listBooks, migratePublishedBookId, reconcilePublishedBookAlias, restoreArchivedBook, type StoredBook } from './engine/library_store'
import { migrateShamelaLocalRelations, shamelaPublicBookId, shamelaSourceBookId } from './shamela_public_identity'
import { CURRENT_SHAMELA_PACK_TEXT_VERSION } from './shamela_reader_contract'
import { shouldParseRawBok } from './shamela_reader_contract'
import { displayableHijriPublicationYear } from './shamela_text_presentation'
import { fetchPagesDataAsset,pinnedReaderBatch } from './pages_data_release'
import { type ShamelaAuthorIndex } from './shamela_author_index'
import { loadShamelaAuthorMetadata } from './shamela_author_metadata'
import {readShamelaCatalogSnapshot} from './shamela_catalog_snapshot'
import {fetchShamelaPackBytes,ShamelaPackSeedError} from './shamela_pack_transport'
import {currentAccountClaims} from './account_authority'
import {getAnnotations,saveAnnotations} from './annotation_store'
import {revalidateBokAnnotations} from './bok_annotation_revalidation'
import {activeBokReaderEntry} from './bok_active_release'
import {createShamelaPreviewBook,loadShamelaReaderEarlyWindow,loadShamelaReaderWindow,locateShamelaReaderShardRef} from './shamela_reader_shards'
export {ShamelaPackSeedError} from './shamela_pack_transport'

export interface ShamelaPackCatalog { title: string | null; author: string | null; authorId: string | null; deathYearHijri?:number|null; category: string | null; publicationYearHijri: number | null; rawSourceMetadata: string | null }
export interface ShamelaPackManifestBook { bookId: string; workId: string; file: string; byteLength: number; sha256: string; counts: { pages: number; titles: number }; categoryId: string | null; contentSha256: string; catalog: ShamelaPackCatalog }
export interface ShamelaPackManifest { schemaVersion: 1; contract: 'shamela-sqlite-pack/manifest-1'; counts: { books: number; pages: number; titles: number }; books: ShamelaPackManifestBook[] }
export interface ShamelaPackCatalogIndex { schemaVersion: 1; contract: 'shamela-sqlite-pack/catalog-1'; batches: Array<{ id: string; manifest: string }> }
export interface LocatedShamelaPackBook { entry: ShamelaPackManifestBook; batchId: string; root: string }
export interface CentralBookOverride {bookId:string;title?:string;author?:string;category?:string|null;visibility:'public'|'unlisted'|'hidden';logicallyDeleted:boolean;revision?:number}
const ROOT='./library/shamela-sample/'
const CATALOG_URL='./library/shamela/catalog.json'
export const SHAMELA_KNOWN_BOOK_COUNT = 8_553
const fetch=((input:RequestInfo|URL,init?:RequestInit)=>{const url=String(input),match=/^\.\/library\/shamela\/batches\/(batch-\d{4})\/books\/([^/?#]+\.json)$/u.exec(url);return match?fetchPagesDataAsset('corpus',`${match[1]}/books/${match[2]}`,url,globalThis.fetch,init):globalThis.fetch(input,init)}) as typeof globalThis.fetch

export function catalogEntryWithVerifiedTitleFallback(entry:ShamelaPackManifestBook):ShamelaPackManifestBook{
  const catalog=entry.catalog??{} as Partial<ShamelaPackCatalog>,candidates:Array<string|null|undefined>=[catalog.title],raw=catalog.rawSourceMetadata
  if(typeof raw==='string'&&raw.trim().startsWith('{'))try{const parsed=JSON.parse(raw) as Record<string,unknown>,metadata=parsed.metadata&&typeof parsed.metadata==='object'?parsed.metadata as Record<string,unknown>:undefined
    for(const value of [parsed.bookName,parsed.book_name,parsed.title,metadata?.bookName,metadata?.book_name,metadata?.title])if(typeof value==='string')candidates.push(value)
  }catch{/* A malformed legacy metadata blob must not replace the manifest title. */}
  const title=verifiedShamelaTitle(...candidates)
  return title===catalog.title?entry:{...entry,catalog:{title,author:catalog.author??null,authorId:catalog.authorId??null,deathYearHijri:catalog.deathYearHijri??null,category:catalog.category??null,publicationYearHijri:catalog.publicationYearHijri??null,rawSourceMetadata:catalog.rawSourceMetadata??null}}
}

export function materializeShamelaCatalogBook(entry: ShamelaPackManifestBook): StoredBook {const catalog=entry.catalog??{} as Partial<ShamelaPackCatalog>,title=verifiedShamelaTitle(catalog.title),catalogAuthor=catalog.author?.trim(),author=catalogAuthor&&catalogAuthor!=='-'&&catalogAuthor!=='غير معروف'?catalogAuthor:UNKNOWN_SHAMELA_AUTHOR,publicationYearHijri=displayableHijriPublicationYear(catalog.publicationYearHijri),deathYearHijri=catalog.deathYearHijri!=null&&catalog.deathYearHijri!==99999?catalog.deathYearHijri:undefined;return{id:shamelaPublicBookId(entry.bookId),sourceKind:'shamela4.1',sourceBookId:entry.bookId,managedSource:'published',sourceFormat:'shamela-bok',title,author,...(author!==UNKNOWN_SHAMELA_AUTHOR&&catalog.authorId?{authorId:`shamela-author-${catalog.authorId}`} : {}),...(deathYearHijri!=null&&author!==UNKNOWN_SHAMELA_AUTHOR?{deathYearHijri}:{}),...(catalog.category?{category:catalog.category}:{}),...(publicationYearHijri!=null?{publicationYearHijri}:{}),...(catalog.rawSourceMetadata!=null?{rawSourceMetadata:catalog.rawSourceMetadata}:{}),fileName:`shamela4_1-${entry.bookId}.catalog.json`,fileSize:0,addedAt:Date.now(),data:new Uint8Array(),mimeType:'application/vnd.alkhizana.shamela-catalog+json',originalSha256:`catalog:${entry.sha256}`,pdfStatus:'pending',coverHue:deterministicCoverHue(title),coverTemplate:deterministicCoverTemplate(title),physicalPageCount:entry.counts.pages,readerPageCount:entry.counts.pages,sourceCitation:`الشاملة 4.1 — ${entry.workId}`}}

export function materializeAvailableShamelaCatalogBooks(entries: readonly ShamelaPackManifestBook[]): StoredBook[] {
  const books: StoredBook[] = []
  for (const entry of entries) {
    try { books.push(materializeShamelaCatalogBook(catalogEntryWithVerifiedTitleFallback(entry))) }
    catch (error) { console.warn('shamela_pack_catalog_entry_unavailable', entry.bookId, error) }
  }
  return books
}

/**
 * Some already-published batch manifests predate the authoritative metadata
 * backfill and therefore contain an empty catalog object.  The lightweight
 * author index is independently verified and contains the real title and
 * author for every attributed book.  Repair the in-memory catalog entry at
 * the boundary instead of dropping an otherwise valid, openable book.
 */
export function enrichShamelaCatalogMetadata(entries: readonly LocatedShamelaPackBook[], index: ShamelaAuthorIndex): LocatedShamelaPackBook[] {
  const metadata = new Map<string, { title: string; author: string; authorId: string; deathYearHijri?: number; category?:string }>()
  for (const author of index.authors) for (const book of author.books) {let title:string;try{title=verifiedShamelaTitle(book.title)}catch{continue}metadata.set(book.sourceBookId, {
    title,
    author: author.name,
    authorId: author.authorId,
    ...(book.category?{category:book.category}:{}),
    ...(author.deathYearHijri != null ? { deathYearHijri: author.deathYearHijri } : {}),
  })}
  return entries.map(located => {
    const fallback = metadata.get(located.entry.bookId)
    if (!fallback) return located
    const catalog = located.entry.catalog ?? {} as Partial<ShamelaPackCatalog>
    const titleMissing = !catalog.title?.trim() || isPlaceholderShamelaTitle(catalog.title)
    const authorMissing = isUnknownShamelaAuthor(catalog.author)
    const categoryMissing=!catalog.category?.trim()
    if (!titleMissing && !authorMissing && !categoryMissing) return located
    return { ...located, entry: { ...located.entry, catalog: {
      title: titleMissing ? verifiedShamelaTitle(fallback.title) : verifiedShamelaTitle(catalog.title),
      author: authorMissing ? fallback.author : catalog.author!,
      authorId: authorMissing ? fallback.authorId : catalog.authorId ?? null,
      deathYearHijri: authorMissing ? fallback.deathYearHijri ?? null : catalog.deathYearHijri ?? null,
      category: categoryMissing ? fallback.category ?? null : catalog.category!,
      publicationYearHijri: catalog.publicationYearHijri ?? null,
      rawSourceMetadata: catalog.rawSourceMetadata ?? null,
    } } }
  })
}

/** يمنع اعتماد كتالوج جزئي أو إسقاط هوية مؤلف موثقة في الفهرس السلطوي. */
export function validateShamelaKnownCatalogCoverage(entries: readonly LocatedShamelaPackBook[], index: ShamelaAuthorIndex): void {
  const indexed=index.authors.flatMap(author=>author.books.map(book=>({bookId:book.sourceBookId,title:book.title,author:author.name})))
  if(index.counts.books!==SHAMELA_KNOWN_BOOK_COUNT||indexed.length!==SHAMELA_KNOWN_BOOK_COUNT)throw new ShamelaPackSeedError('shamela_known_index_count_mismatch')
  const catalog=new Map(entries.map(item=>[item.entry.bookId,item.entry] as const))
  for(const expected of indexed){const entry=catalog.get(expected.bookId);if(!entry)throw new ShamelaPackSeedError('shamela_known_catalog_book_missing');if(entry.catalog.title?.trim()!==expected.title||isUnknownShamelaAuthor(entry.catalog.author)||entry.catalog.author?.trim()!==expected.author)throw new ShamelaPackSeedError('shamela_known_catalog_identity_mismatch')}
}

const directoryOf=(path:string):string=>path.slice(0,path.lastIndexOf('/')+1)
const portablePath=(root:string,file:string):string=>`${root}${file.replace(/^\.\//,'')}`
function validManifest(value:unknown):value is ShamelaPackManifest {const manifest=value as Partial<ShamelaPackManifest>;return manifest?.contract==='shamela-sqlite-pack/manifest-1'&&Array.isArray(manifest.books)&&manifest.books.length===manifest.counts?.books}
async function fetchManifest(path:string,fetcher:typeof fetch):Promise<ShamelaPackManifest>{let last:unknown;for(const cache of ['reload','no-cache','force-cache'] as const){try{const response=await fetcher(path,{cache,credentials:'same-origin'});if(!response.ok)throw new ShamelaPackSeedError(`shamela_pack_manifest_http_${response.status}`);if(response.headers.get('content-type')?.toLowerCase().includes('text/html'))throw new ShamelaPackSeedError('shamela_pack_manifest_spa_fallback');let manifest:unknown;try{manifest=await response.json()}catch(error){throw new ShamelaPackSeedError('shamela_pack_manifest_json_invalid',error)}if(!validManifest(manifest))throw new ShamelaPackSeedError('shamela_pack_manifest_invalid');return manifest}catch(error){last=error}}throw last instanceof ShamelaPackSeedError?last:new ShamelaPackSeedError('shamela_pack_manifest_unavailable',last)}
function resolveBatchManifestPath(path:string):string {const clean=path.replace(/^\.\//,'');return clean.startsWith('library/')?`./${clean}`:portablePath(directoryOf(CATALOG_URL),clean)}
async function fetchBatchManifests(batches:readonly {id:string;manifest:string}[],fetcher:typeof fetch):Promise<Array<PromiseSettledResult<{batch:{id:string;manifest:string};manifest:ShamelaPackManifest;root:string}>>>{
  const results:Array<PromiseSettledResult<{batch:{id:string;manifest:string};manifest:ShamelaPackManifest;root:string}>>=new Array(batches.length);let cursor=0
  await Promise.all(Array.from({length:Math.min(8,batches.length)},async()=>{while(cursor<batches.length){const index=cursor++,batch=batches[index]!;try{if(!batch.id||!/^\.\/[^?#]+\.json$/u.test(batch.manifest)||batch.manifest.includes('..'))throw new ShamelaPackSeedError('shamela_pack_catalog_batch_invalid');const manifestPath=resolveBatchManifestPath(batch.manifest),manifest=await fetchManifest(manifestPath,fetcher);results[index]={status:'fulfilled',value:{batch,manifest,root:directoryOf(manifestPath)}}}catch(reason){results[index]={status:'rejected',reason}}}}))
  return results
}
async function readShamelaCatalogWithPolicy(fetcher:typeof fetch,requireComplete:boolean):Promise<LocatedShamelaPackBook[]>{
  let response:Response
  try{response=await fetcher(CATALOG_URL,{cache:'no-cache',credentials:'same-origin'})}catch(error){throw new ShamelaPackSeedError('shamela_pack_catalog_fetch_failed',error)}
  const batches:Array<{id:string;manifest:string}>=[]
  const contentType=response.headers.get('content-type')?.toLowerCase()??''
  // خوادم SPA (Vite/Pages) قد تعيد index.html بحالة 200 لمسار catalog غير
  // المنشور. هذه ليست كتالوجًا تالفًا؛ هي إشارة توافق للـmanifest القديم.
  if(response.ok&&!contentType.includes('text/html')){let catalog:ShamelaPackCatalogIndex;try{catalog=await response.json() as ShamelaPackCatalogIndex}catch(error){throw new ShamelaPackSeedError('shamela_pack_catalog_json_invalid',error)}if(catalog.contract!=='shamela-sqlite-pack/catalog-1'||!Array.isArray(catalog.batches))throw new ShamelaPackSeedError('shamela_pack_catalog_invalid');batches.push(...catalog.batches)}
  else if(response.status===404||contentType.includes('text/html')){batches.push({id:'legacy-sample',manifest:`${ROOT}manifest.json`})}
  else throw new ShamelaPackSeedError(`shamela_pack_catalog_http_${response.status}`)
  // فهرس الموقع الحي يجب أن يظهر كاملًا من المصدر المركزي. تحميل manifests
  // بالتتابع كان يجعل البطاقات تصل إلى كل متصفح ببطء شديد وكأن الكتب تُضاف
  // دوريًا. نجلب الدفعات بالتوازي ثم نحافظ على ترتيب الكتالوج الأصلي.
  const settled=await fetchBatchManifests(batches,fetcher)
  const loaded=settled.flatMap(result=>result.status==='fulfilled'?[result.value]:[])
  // يتكون الكتالوج المنشور من عشرات الدفعات المستقلة. تعثر طلب واحد عابر
  // لا يجوز أن يحول صفحة كل قسم إلى مكتبة فارغة؛ نعرض الدفعات السليمة،
  // وتعيد الزيارة التالية محاولة الدفعة المتعثرة من دون إسقاط بقية الكتب.
  for(const result of settled)if(result.status==='rejected')console.warn('shamela_pack_catalog_batch_unavailable',result.reason)
  if(!loaded.length&&batches.length)throw new ShamelaPackSeedError('shamela_pack_catalog_all_batches_unavailable')
  // شاشة الأقسام لا يجوز أن تحفظ عينة الدفعات الناجحة في ذاكرة الجلسة على
  // أنها الكتالوج الكامل. هذا هو ما كان يجعل «الشعر ودواوينه» يثبت على 3
  // كتب مع أن manifests السلطوية تحمل 25. يبقى المسار المرن متاحًا للقراء
  // الفردية، أما قائمة المكتبة فتطلب اكتمال كل دفعات الفهرس قبل اعتمادها.
  if(requireComplete&&loaded.length!==batches.length)throw new ShamelaPackSeedError('shamela_pack_catalog_incomplete')
  const located:LocatedShamelaPackBook[]=[];const ids=new Set<string>()
  for(const {batch,manifest,root} of loaded){for(const entry of manifest.books){if(ids.has(entry.bookId))throw new ShamelaPackSeedError('shamela_pack_catalog_duplicate_book');ids.add(entry.bookId);located.push({entry,batchId:batch.id,root})}}
  return located
}
export function readShamelaCatalog(fetcher:typeof fetch=fetch):Promise<LocatedShamelaPackBook[]>{return readShamelaCatalogWithPolicy(fetcher,false)}
export async function readCompleteShamelaCatalog(fetcher:typeof fetch=fetch):Promise<LocatedShamelaPackBook[]>{let last:unknown;for(let attempt=0;attempt<3;attempt++){try{return await readShamelaCatalogWithPolicy(fetcher,true)}catch(error){last=error;if(attempt<2)await new Promise<void>(resolve=>setTimeout(resolve,150*(attempt+1)))}}throw last}
/** شبكة المكتبة لا يجوز أن تستهلك manifests القديمة مباشرة؛ آخر الدفعات
 * المنشورة قد تحمل عنوانًا/مؤلفًا فارغًا مع أن فهرس الهوية الخفيف يحتوي
 * القيمة الموثقة. عدم الدمج هنا أسقط 2,194 بطاقة وأبقى ثلاثة دواوين فقط. */
import {catalogDataInteractionAllowed,waitForBackgroundDataInteraction} from './background_data_scheduler'
export async function readCompleteShamelaLibraryCatalog(fetcher:typeof fetch=fetch):Promise<LocatedShamelaPackBook[]>{
  // Do not turn one bounded snapshot failure into 86 batch downloads (and
  // repeated full-catalog retries). Preserve the failure and snapshot cooldown.
  // Legacy callers can explicitly use readCompleteShamelaCatalog when needed.
  const [catalog,index]=await Promise.all([readShamelaCatalogSnapshot(fetcher),loadShamelaAuthorMetadata()])
  await waitForBackgroundDataInteraction({canRun:catalogDataInteractionAllowed})
  const enriched=enrichShamelaCatalogMetadata(catalog,index)
  validateShamelaKnownCatalogCoverage(enriched,index)
  return enriched
}
async function loadCatalog():Promise<LocatedShamelaPackBook[]|undefined>{try{return await sessionCatalog()}catch{return}}
let sessionCatalogPromise:Promise<LocatedShamelaPackBook[]>|undefined
if(typeof window!=='undefined')window.addEventListener('alkhizana:central-book-mutated',()=>{sessionCatalogPromise=undefined})
export function applyCentralBookOverrides(catalog:LocatedShamelaPackBook[],overrides:CentralBookOverride[]):LocatedShamelaPackBook[]{const byId=new Map(overrides.map(item=>[item.bookId,item]));return catalog.flatMap(item=>{const override=byId.get(shamelaPublicBookId(item.entry.bookId))??byId.get(item.entry.bookId);if(!override)return[item];if(override.logicallyDeleted||override.visibility==='hidden')return[];const entry={...item.entry,catalog:{...item.entry.catalog,...(override.title?{title:override.title}:{}),...(override.author?{author:override.author}:{}),...(override.category!==undefined?{category:override.category}:{})}};return[{...item,entry}]})}
function centralOverrideFor(overrides:CentralBookOverride[],sourceBookId:string):CentralBookOverride|undefined{return overrides.find(item=>item.bookId===sourceBookId||item.bookId===shamelaPublicBookId(sourceBookId))}
export function applyCentralOverrideToStoredBook(book:StoredBook,override:CentralBookOverride):StoredBook{const updated={...book,...(override.title?{title:override.title}:{}),...(override.author?{author:override.author}:{}),visibility:override.visibility,...(override.logicallyDeleted?{logicallyDeletedAt:Date.now()}: {})};if(!override.logicallyDeleted)delete updated.logicallyDeletedAt;if(override.category!==undefined){if(override.category)updated.category=override.category;else delete updated.category;delete updated.categoryOverride}return updated}
const CENTRAL_OVERRIDES_CACHE_KEY='alkhizana:central-book-overrides:v1'
function validCentralOverrides(payload:{schemaVersion?:unknown;overrides?:unknown}):CentralBookOverride[]{
  if(payload.schemaVersion!==1||!Array.isArray(payload.overrides))return[]
  return payload.overrides.filter((item):item is CentralBookOverride=>{if(!item||typeof item!=='object')return false;const value=item as Partial<CentralBookOverride>;return typeof value.bookId==='string'&&['public','unlisted','hidden'].includes(value.visibility??'')&&typeof value.logicallyDeleted==='boolean'&&(value.title===undefined||typeof value.title==='string')&&(value.author===undefined||typeof value.author==='string')&&(value.category===undefined||value.category===null||typeof value.category==='string')})
}
function cachedCentralOverrides():CentralBookOverride[]{try{return validCentralOverrides(JSON.parse(localStorage.getItem(CENTRAL_OVERRIDES_CACHE_KEY)??'{}'))}catch{return[]}}
/** Filter after merging IndexedDB: a cached book must not resurrect a hidden title. */
export function applyCentralOverridesToBookList(books:StoredBook[],overrides:CentralBookOverride[]=cachedCentralOverrides()):StoredBook[]{
 const byId=new Map(overrides.map(o=>[o.bookId,o]));
 return books.flatMap(book=>{
  if(book.managedSource!=='published')return [book];
  const id=book.id.replace(/^central-submission:/,'');
  const override=byId.get(id)??(book.sourceBookId?byId.get(book.sourceBookId):undefined);
  if(!override)return [book];
  if(override.logicallyDeleted||override.visibility!=='public')return [];
  return [applyCentralOverrideToStoredBook(book,override)];
 });
}
export async function loadCentralBookOverrides(fetcher:typeof fetch=fetch,offline=false,sourceBookId?:string):Promise<CentralBookOverride[]>{
  const relevant=(rows:CentralBookOverride[]):CentralBookOverride[]=>sourceBookId===undefined?rows:rows.filter(row=>row.bookId===sourceBookId||row.bookId===shamelaPublicBookId(sourceBookId))
  if(offline)return relevant(cachedCentralOverrides())
  try{
    const url=sourceBookId===undefined?'./api/library/central-overrides':`./api/library/central-overrides?bookId=${encodeURIComponent(shamelaPublicBookId(sourceBookId))}`
    const response=await fetcher(url,{cache:'no-cache',credentials:'same-origin',signal:AbortSignal.timeout(10000)})
    if(!response.ok)return relevant(cachedCentralOverrides())
    const payload=await response.json() as {schemaVersion?:unknown;overrides?:unknown}
    if(payload.schemaVersion!==1||!Array.isArray(payload.overrides))return relevant(cachedCentralOverrides())
    const incoming=relevant(validCentralOverrides(payload)),known=cachedCentralOverrides(),byId=new Map(incoming.map(row=>[row.bookId,row]))
    for(const row of known)if(Number(row.revision)>Number(byId.get(row.bookId)?.revision??-1))byId.set(row.bookId,row)
    const overrides=[...byId.values()]
    try{localStorage.setItem(CENTRAL_OVERRIDES_CACHE_KEY,JSON.stringify({schemaVersion:1,overrides}))}catch{/* Optional public metadata cache. */}
    return relevant(overrides)
  }catch{return relevant(cachedCentralOverrides())}
}
function sessionCatalog():Promise<LocatedShamelaPackBook[]> {
  sessionCatalogPromise ??= readCompleteShamelaCatalog()
    .then(async catalog => {
      // The metadata index repairs older deployed manifests, but temporary
      // unavailability must never block manifests that are already complete.
      const index = await loadShamelaAuthorMetadata().catch(() => undefined)
      const enriched=index?enrichShamelaCatalogMetadata(catalog,index):catalog
      if(index)validateShamelaKnownCatalogCoverage(enriched,index)
      return applyCentralBookOverrides(enriched,await loadCentralBookOverrides())
    })
    .catch(error => { sessionCatalogPromise=undefined; throw error })
  return sessionCatalogPromise
}
async function locateShamelaBookFast(sourceBookId:string):Promise<LocatedShamelaPackBook|undefined>{
  // Most current manifests already have complete display metadata. The small
  // pinned map can locate those before downloading metadata for every author.
  // This is route metadata only; the caller's visibility fence remains intact.
  const pinnedBatch=await pinnedReaderBatch(sourceBookId).catch(()=>undefined)
  if(pinnedBatch){
    const manifestPath=`./library/shamela/batches/${pinnedBatch}/manifest.json`
    const manifest=await fetchManifest(manifestPath,fetch),raw=manifest.books.find(book=>book.bookId===sourceBookId)
    const entry=raw&&catalogEntryWithVerifiedTitleFallback(raw)
    if(entry?.catalog.title&&!isPlaceholderShamelaTitle(entry.catalog.title)&&!isUnknownShamelaAuthor(entry.catalog.author)&&entry.catalog.category?.trim())return {entry,batchId:pinnedBatch,root:directoryOf(manifestPath)}
  }
  const index=await loadShamelaAuthorMetadata(),ref=index.authors.flatMap(author=>author.books).find(book=>book.sourceBookId===sourceBookId)
  // A few published books have no author-index entry. The pinned immutable
  // shard catalog locates those without scanning all 86 batch manifests.
  const sidecar=ref?undefined:await locateShamelaReaderShardRef(sourceBookId).catch(()=>undefined)
  const batchId=ref?.batchId??sidecar?.batchId
  if(!batchId)return
  const manifestPath=`./library/shamela/batches/${batchId}/manifest.json`,manifest=await fetchManifest(manifestPath,fetch),entry=manifest.books.find(book=>book.bookId===sourceBookId)
  if(!entry)return
  if(sidecar&&(entry.sha256!==sidecar.sourceSha256||entry.counts.pages!==sidecar.counts.pages||entry.counts.titles!==sidecar.counts.titles))throw new ShamelaPackSeedError('shamela_reader_shard_catalog_mismatch')
  return enrichShamelaCatalogMetadata([{entry,batchId,root:directoryOf(manifestPath)}],index)[0]
}
export function shamelaBookNeedsHydration(existing:StoredBook|undefined,entry:ShamelaPackManifestBook):boolean {return !existing||existing.bokTextVersion!==CURRENT_SHAMELA_PACK_TEXT_VERSION||existing.originalSha256!==entry.sha256||existing.bokPages?.length!==entry.counts.pages||existing.bokToc===undefined||existing.bokToc.length!==entry.counts.titles||shouldParseRawBok(existing,'shamela-bok')}
async function reconcileCatalogEntry(entry:ShamelaPackManifestBook):Promise<{book:StoredBook;installed:boolean}>{const sourceBookId=entry.bookId,targetId=shamelaPublicBookId(sourceBookId),legacyId=`shamela-${sourceBookId}`,catalogBook=materializeShamelaCatalogBook(entry);let existing=await getBook(targetId),legacy=await getBook(legacyId),installed=false;if(!existing&&!legacy){existing=catalogBook;await restoreArchivedBook(existing);installed=true}else if(!existing&&legacy){const migrated={...legacy,id:targetId,sourceKind:'shamela4.1' as const,sourceBookId,title:isPlaceholderShamelaTitle(legacy.title)?catalogBook.title:legacy.title};if(displayableHijriPublicationYear(migrated.publicationYearHijri)==null)delete migrated.publicationYearHijri;await migratePublishedBookId(legacyId,migrated);existing=migrated}else if(existing&&legacy){try{existing=await reconcilePublishedBookAlias(legacyId,targetId,sourceBookId,entry.sha256)}catch(error){throw new ShamelaPackSeedError('shamela_public_id_collision',error)}}if(existing){const repaired={...existing,title:isPlaceholderShamelaTitle(existing.title)?catalogBook.title:existing.title,author:isUnknownShamelaAuthor(existing.author)?catalogBook.author:existing.author,...(catalogBook.authorId?{authorId:catalogBook.authorId}:{}),...(catalogBook.deathYearHijri!=null?{deathYearHijri:catalogBook.deathYearHijri}:{}),...(catalogBook.category?{category:catalogBook.category}:{}),...(catalogBook.publicationYearHijri!=null?{publicationYearHijri:catalogBook.publicationYearHijri}:{}),...(catalogBook.rawSourceMetadata!=null?{rawSourceMetadata:catalogBook.rawSourceMetadata}:{})};if(catalogBook.author===UNKNOWN_SHAMELA_AUTHOR){delete repaired.authorId;delete repaired.deathYearHijri}if(catalogBook.category&&repaired.categoryOverride?.value.trim()==='غير مصنف')delete repaired.categoryOverride;if(repaired.title!==existing.title){repaired.coverHue=deterministicCoverHue(repaired.title);repaired.coverTemplate=deterministicCoverTemplate(repaired.title)}if(repaired.title!==existing.title||repaired.author!==existing.author||repaired.authorId!==existing.authorId||repaired.deathYearHijri!==existing.deathYearHijri||repaired.category!==existing.category||repaired.categoryOverride!==existing.categoryOverride||repaired.publicationYearHijri!==existing.publicationYearHijri||repaired.rawSourceMetadata!==existing.rawSourceMetadata){existing=repaired;await restoreArchivedBook(existing)}}migrateShamelaLocalRelations(localStorage,sourceBookId);return{book:existing!,installed}}
async function hydrateEntry(located:LocatedShamelaPackBook):Promise<StoredBook>{
 const {entry,root}=located
 const annotationIdentity=currentAccountClaims()
 try{
  const packed=await fetchShamelaPackBytes(portablePath(root,entry.file),entry.byteLength,fetch,20000,entry.sha256)
  const book=await prepareShamelaPackBook(packed,entry)
  if(shouldParseRawBok(book,'shamela-bok'))throw new ShamelaPackSeedError('shamela_pack_derived_text_incomplete')
  const previous=await getBook(book.id)
  if(previous?.bokPages?.length&&previous.originalSha256!==book.originalSha256){
   const activeIdentity=currentAccountClaims()
   if(activeIdentity?.subject!==annotationIdentity?.subject||activeIdentity?.sessionId!==annotationIdentity?.sessionId)throw new ShamelaPackSeedError('shamela_pack_session_changed')
   // Fail closed if source page identity changes; keep the previous reader/notes intact.
   saveAnnotations(revalidateBokAnnotations(getAnnotations(),previous,book))
  }
  try{await restoreArchivedBook(book)}catch(error){throw new ShamelaPackSeedError(error instanceof Error&&error.name==='QuotaExceededError'?'shamela_pack_book_storage_full':'shamela_pack_book_storage_failed',error)}
  return book
 }catch(error){if(error instanceof ShamelaPackSeedError)throw error;throw new ShamelaPackSeedError('shamela_pack_book_hydration_failed',error)}
}
export async function ensureShamelaBookReady(id:string,onPreview?:(book:StoredBook)=>void,requestedPageIndex=0):Promise<StoredBook>{
 const sourceBookId=shamelaSourceBookId(id);if(!sourceBookId)throw new ShamelaPackSeedError('shamela_pack_book_id_invalid')
 const offline=typeof navigator!=='undefined'&&navigator.onLine===false
 // Read the local copy while checking publication visibility, not afterwards.
 // Neither the copy nor remote book bytes may be exposed before this check.
 // Public routing metadata is safe to prefetch while the visibility request
 // runs. Never hydrate or expose book bytes until the visibility fence below.
 // Offline opens must not start either metadata network request.
 const [overrides,cachedBook,fast]=await Promise.all([
  loadCentralBookOverrides(fetch,offline,sourceBookId),
  getBook(shamelaPublicBookId(sourceBookId)),
  offline?Promise.resolve(undefined):locateShamelaBookFast(sourceBookId).catch(()=>undefined),
 ])
 const override=centralOverrideFor(overrides,sourceBookId)
 if(override&&(override.logicallyDeleted||override.visibility==='hidden'))throw new ShamelaPackSeedError('shamela_pack_book_not_found')
 let existing=cachedBook
 if(offline&&existing&&(existing.visibility==='hidden'||existing.logicallyDeletedAt))throw new ShamelaPackSeedError('shamela_pack_book_not_found')
 if(existing&&override){const repaired=applyCentralOverrideToStoredBook(existing,override);if(repaired.title!==existing.title||repaired.author!==existing.author||repaired.visibility!==existing.visibility){await restoreArchivedBook(repaired);existing=repaired}}
 // Offline keeps the verified downloaded edition. Online must check its source digest,
 // otherwise the old fast return prevents every later published text correction.
 if(offline&&existing?.bokPages?.length&&existing.bokToc!==undefined&&existing.bokTextVersion===CURRENT_SHAMELA_PACK_TEXT_VERSION&&!shouldParseRawBok(existing,'shamela-bok'))return existing
 const fastCandidates:LocatedShamelaPackBook[]=fast?applyCentralBookOverrides([fast],override?[override]:[]):[]
 let located=fastCandidates[0]??(await sessionCatalog()).find(x=>x.entry.bookId===sourceBookId)
 if(!located)throw new ShamelaPackSeedError('shamela_pack_book_not_found')
 const corrected=await activeBokReaderEntry(sourceBookId)
 if(corrected)located={...located,root:corrected.root,entry:{...located.entry,...corrected.entry,catalog:located.entry.catalog} as ShamelaPackManifestBook}
 if(existing&&!shamelaBookNeedsHydration(existing,located.entry))return existing
 let verifiedPreview:StoredBook|undefined
 const hasReaderShards=located.entry.byteLength>=2*1024*1024||located.entry.counts.pages>=2000
 if(!offline&&onPreview&&hasReaderShards&&Number.isSafeInteger(requestedPageIndex)&&requestedPageIndex>=0&&requestedPageIndex<located.entry.counts.pages){
  const preview=(window:NonNullable<Awaited<ReturnType<typeof loadShamelaReaderWindow>>>|Awaited<ReturnType<typeof loadShamelaReaderEarlyWindow>>)=>{const book=createShamelaPreviewBook(window,sourceBookId,located.batchId,located.entry.catalog.title??existing?.title??'');if(override)Object.assign(book,applyCentralOverrideToStoredBook(book,override));verifiedPreview=book;onPreview(book)}
  const complete=loadShamelaReaderWindow(sourceBookId,located.batchId,located.entry.sha256,located.entry.workId,located.entry.counts.pages,located.entry.counts.titles,requestedPageIndex).catch(error=>{console.warn('shamela_reader_full_toc_unavailable',sourceBookId,error);return undefined})
  // Match the sidecar builder's byte/page thresholds. Some books compress
  // well yet still contain thousands of pages and suffer the same DOM delay.
  // Truly small books have no route and avoid a speculative 404 on open.
  try{preview(await loadShamelaReaderEarlyWindow(sourceBookId,located.batchId,located.entry.sha256,located.entry.workId,located.entry.counts.pages,located.entry.counts.titles,requestedPageIndex))}catch(error){console.warn('shamela_reader_early_preview_unavailable',sourceBookId,error)}
  const window=await complete;if(window)preview(window)
 }
 try{
  let {book}=await reconcileCatalogEntry(located.entry)
  if(override){book=applyCentralOverrideToStoredBook(book,override);await restoreArchivedBook(book)}
  if(!shamelaBookNeedsHydration(book,located.entry))return book
  // Give the requested verified page a rendering opportunity before the
  // complete source transfer and IndexedDB write compete for the main thread.
  if(onPreview&&typeof requestAnimationFrame==='function')await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
  let hydrated=await hydrateEntry(located)
  if(override){hydrated=applyCentralOverrideToStoredBook(hydrated,override);await restoreArchivedBook(hydrated)}
  return hydrated
 }catch(error){
  // A background full-pack failure must not replace already authenticated
  // readable pages with an error. The sparse book still loads distant shards
  // on demand and remains explicitly partial until full hydration succeeds.
  if(verifiedPreview){console.warn('shamela_full_pack_background_failed',sourceBookId,error);return verifiedPreview}
  throw error
 }
}
export function selectShamelaEntriesForDownload(manifest:ShamelaPackManifest,id?:string):ShamelaPackManifestBook[]{const sourceBookId=id?shamelaSourceBookId(id):undefined;return sourceBookId?manifest.books.filter(x=>x.bookId===sourceBookId):[]}
const SHAMELA_CATALOG_READY_KEY='alkhizana:shamela-catalog-ready-v1'
export const SHAMELA_CATALOG_METADATA_REVISION='catalog-metadata-v5'
export function catalogReadyToken(catalog:LocatedShamelaPackBook[]):string {const first=catalog[0]?.entry,last=catalog.at(-1)?.entry;return `${SHAMELA_CATALOG_METADATA_REVISION}:${catalog.length}:${first?.bookId??''}:${first?.sha256??''}:${last?.bookId??''}:${last?.sha256??''}`}
export function catalogMetadataTokenMatches(stored:string|null,catalog:LocatedShamelaPackBook[]):boolean{return stored===catalogReadyToken(catalog)}
export function catalogEntryMatchesStoredBook(book:StoredBook|undefined,entry:ShamelaPackManifestBook):boolean {
  if(!book)return false
  // البطاقة الخفيفة تحمل البادئة لتمييزها عن ملف الكتاب المحمّل، وكلاهما
  // مبني على SHA نفسه وصالح كدليل اكتمال metadata.
  return book.originalSha256===entry.sha256||book.originalSha256===`catalog:${entry.sha256}`
}
async function catalogAlreadyReady(catalog:LocatedShamelaPackBook[]):Promise<boolean>{
  const tokenMatches=typeof localStorage!=='undefined'&&catalogMetadataTokenMatches(localStorage.getItem(SHAMELA_CATALOG_READY_KEY),catalog)
  // لا تكفي مطابقة عينات SHA لترقية metadata قديمة: قد تكون البايتات صحيحة
  // بينما بقي العنوان الوهمي محفوظًا. كل مراجعة metadata جديدة تجبر مصالحة
  // بطاقات الكتالوج مرة واحدة، ثم يعود المسار السريع في الزيارات التالية.
  if(!tokenMatches)return false
  const storedCount=(await listBooks()).filter(book=>book.sourceKind==='shamela4.1').length
  if(storedCount!==catalog.length)return false
  const indexes=[0,Math.floor(catalog.length/2),catalog.length-1]
  const probes=indexes.map(index=>catalog[index]?.entry).filter((entry):entry is ShamelaPackManifestBook=>Boolean(entry))
  const books=await Promise.all(probes.map(entry=>getBook(shamelaPublicBookId(entry.bookId))))
  const ready=books.every((book,index)=>catalogEntryMatchesStoredBook(book,probes[index]!))
  if(ready&&typeof localStorage!=='undefined')localStorage.setItem(SHAMELA_CATALOG_READY_KEY,catalogReadyToken(catalog))
  return ready
}
export async function ensureShamelaSampleSeeded(id?:string):Promise<{installed:number;failed:number}> {if(id){try{await ensureShamelaBookReady(id);return{installed:1,failed:0}}catch(error){console.warn('shamela_pack_book_seed_failed',error);return{installed:0,failed:1}}}const catalog=await loadCatalog();if(!catalog)return{installed:0,failed:0};if(await catalogAlreadyReady(catalog))return{installed:0,failed:0};let installed=0,failed=0,index=0;for(const {entry} of catalog){while(typeof location!=='undefined'&&routeLocation.hash.startsWith('#/reader/'))await new Promise<void>(resolve=>setTimeout(resolve,100));try{const result=await reconcileCatalogEntry(entry);if(result.installed)installed++}catch(error){console.warn('shamela_pack_catalog_reconcile_failed',entry.bookId,error);failed++}if(++index%25===0){if(installed)window.dispatchEvent(new CustomEvent('library-changed'));await new Promise<void>(resolve=>setTimeout(resolve,0))}}
  if(!failed&&typeof localStorage!=='undefined')localStorage.setItem(SHAMELA_CATALOG_READY_KEY,catalogReadyToken(catalog));if(installed)window.dispatchEvent(new CustomEvent('library-changed'));return{installed,failed}}
import {routeLocation} from "./path_location"

import type { StoredAuthor, StoredBook } from './engine/library_store'
import type { ShamelaAuthorIndexEntry } from './shamela_author_index'
import { displayableAuthorDeathYear } from './author_filter'
import {canonicalAuthorIdentity} from './author_display_names'

export const PEOPLE_ROUTE_DIGITS = 6

export interface BiographySource {
  provider: 'shamela.ws' | 'tarajm.com' | 'local'
  sourceUrl: string
  verifiedAt: string
  citationTitle?: string
}

export interface SourcedValue<T> extends BiographySource { value: T }

export interface BiographySection {
  title: string
  paragraphs: string[]
  source: BiographySource
}

export interface BiographyRelation {
  tarajmExternalId: string
  name: string
}

export interface BiographyDate {
  hijri?: number
  gregorian?: number
  place?: string
  calculation?: {
    status: 'calculated' | 'calculated-reviewed'
    method: 'hijri-year-to-gregorian-estimate/1' | 'gregorian-year-to-hijri-estimate/1'
    approximate: true
    reviewedSources?: string[]
  }
}

export interface StructuredBiography {
  contemporary?: boolean
  summary?: SourcedValue<string>
  displayName?: SourcedValue<string>
  fullName?: SourcedValue<string>
  knownAs?: SourcedValue<string[]>
  lineage?: SourcedValue<string>
  birth?: SourcedValue<BiographyDate>
  death?: SourcedValue<BiographyDate>
  reportedAge?: SourcedValue<{ years: number; approximate: boolean }>
  places?: SourcedValue<string[]>
  teachers?: SourcedValue<string[]>
  students?: SourcedValue<string[]>
  teacherLinks?: SourcedValue<BiographyRelation[]>
  studentLinks?: SourcedValue<BiographyRelation[]>
  traits?: SourcedValue<string[]>
  categories?: SourcedValue<string[]>
  positions?: SourcedValue<string[]>
  works?: SourcedValue<string[]>
  sections?: BiographySection[]
  sources: BiographySource[]
  tarajmExternalId?: string
}

export interface BiographyProvider {
  readonly id: string
  getByExternalId(externalId: string, signal?: AbortSignal): Promise<StructuredBiography | undefined>
}

export interface TarajmBiographyCacheRecord {
  schema: 'alkhizana-tarajm-biography-cache'
  version: 1
  externalId: string
  fetchedAt: string
  biography: StructuredBiography
}

export interface TarajmAuthorMapping {
  shamelaAuthorId: string
  tarajmExternalId: string
  evidence: { sourceUrl: string; matchedName: string; matchedDeathYearHijri?: number; reviewedAt?: string }
}

export interface AuditedTarajmIdentity {
  shamelaAuthorId?: string
  names?: readonly string[]
  deathYearHijri?: number
}

interface TarajmLocalBundle {
  biography?: StructuredBiography
  peopleHrefByTarajmId: ReadonlyMap<string, string>
}

export type PeopleFacetKind = 'place' | 'trait'
export interface TarajmFacetRecord { shamelaAuthorId: string; biography: StructuredBiography }

export function normalizePeopleFacet(value: string): string {
  return value.normalize('NFKD').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/gu, '')
    .replace(/[أإآٱ]/gu, 'ا').replace(/ى/gu, 'ي').replace(/ة/gu, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('ar')
}

export type AuthorEntityKind = 'person' | 'collective' | 'organization'

/** Exact catalog labels only: never infer that an unfamiliar human name is an organization. */
export function authorEntityKind(name: string): AuthorEntityKind {
  const normalized = normalizePeopleFacet(name)
  if (normalized === normalizePeopleFacet('مجموعة من المؤلفين')
    || normalized === normalizePeopleFacet('مجهولون')) return 'collective'
  if (normalized === normalizePeopleFacet('جامعة المدينة العالمية')
    || normalized === normalizePeopleFacet('اللجنة الدائمة للبحوث العلمية والإفتاء')
    || normalized === normalizePeopleFacet('ملتقى أهل الحديث')) return 'organization'
  return 'person'
}

function normalizeAuditedPersonAlias(value: string): string {
  return normalizePeopleFacet(value).replace(/^(?:(?:الامام|الحافظ|الشيخ|العلامه)\s+)+/u, '')
}

export function resolveAuditedTarajmMapping(mappings: readonly TarajmAuthorMapping[], identity: AuditedTarajmIdentity): TarajmAuthorMapping | undefined {
  const directId = identity.shamelaAuthorId?.trim()
  if (directId) {
    const direct = mappings.find(item => item.shamelaAuthorId === directId)
    if (direct) return direct
  }
  const names = new Set((identity.names ?? []).map(normalizeAuditedPersonAlias).filter(Boolean))
  if (!names.size || !Number.isInteger(identity.deathYearHijri)) return undefined
  const candidates = mappings.filter(item => item.evidence.matchedDeathYearHijri === identity.deathYearHijri
    && names.has(normalizeAuditedPersonAlias(item.evidence.matchedName)))
  return candidates.length === 1 ? candidates[0] : undefined
}

/** Normalize a person's name only when rendered as a standalone label. */
export function standaloneArabicPersonName(value: string): string {
  const trimmed = value.trim().replace(/\s+/gu, ' ')
  return trimmed.replace(/^(?:أبي|أبا)(?=\s)/u, 'أبو')
}

export function biographyForPresentation(biography: StructuredBiography): StructuredBiography {
  const nameValue = (field: SourcedValue<string>) => ({ ...field, value: standaloneArabicPersonName(field.value) })
  const nameList = (field: SourcedValue<string[]>) => ({ ...field, value: field.value.map(standaloneArabicPersonName) })
  const relationList = (field: SourcedValue<BiographyRelation[]>) => ({
    ...field,
    value: field.value.map(relation => ({ ...relation, name: standaloneArabicPersonName(relation.name) })),
  })
  return {
    ...biography,
    ...(biography.places ? { places: { ...biography.places, value: [...new Set(biography.places.value.map(place => [...new Map(place.split(/[،,]/u).map(part => [normalizePeopleFacet(part), part.trim()])).values()].filter(Boolean).join('، ')))] } } : {}),
    ...(biography.displayName ? { displayName: nameValue(biography.displayName) } : {}),
    ...(biography.fullName ? { fullName: nameValue(biography.fullName) } : {}),
    ...(biography.knownAs ? { knownAs: nameList(biography.knownAs) } : {}),
    ...(biography.teachers ? { teachers: nameList(biography.teachers) } : {}),
    ...(biography.students ? { students: nameList(biography.students) } : {}),
    ...(biography.teacherLinks ? { teacherLinks: relationList(biography.teacherLinks) } : {}),
    ...(biography.studentLinks ? { studentLinks: relationList(biography.studentLinks) } : {}),
  }
}

export function biographyDisplayName(biography: StructuredBiography | undefined, fallback: string): string {
  return standaloneArabicPersonName(biography?.displayName?.value || fallback)
}

export function biographyFullNameAddsInformation(displayName: string, fullName: string | undefined): boolean {
  const display = normalizePeopleFacet(displayName)
  const full = normalizePeopleFacet(fullName ?? '')
  return Boolean(display && full && display !== full)
}

export type BiographyContentBlock = { kind: 'heading' | 'paragraph'; text: string }

/** Presentation only: preserve source bytes and never insert decoded HTML. */
export function biographyPlainDisplay(value:string):string {
  const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',laquo:'«',raquo:'»',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',ndash:'–',mdash:'—',hellip:'…'}
  for(let pass=0;pass<3;pass++){
    const decoded=value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/giu,(raw,key:string)=>{
      if(!key.startsWith('#'))return named[key.toLowerCase()]??raw
      const cp=key[1]?.toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1))
      return Number.isInteger(cp)&&cp>0&&cp<=0x10ffff&&!(cp>=0xd800&&cp<=0xdfff)?String.fromCodePoint(cp):raw
    })
    if(decoded===value)break
    value=decoded
  }
  return value.replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/giu,' ').replace(/<[^>]*>/gu,' ')
}

export function biographyContentBlocks(paragraphs: readonly string[]): BiographyContentBlock[] {
  return paragraphs.flatMap(paragraph => {
    const lines = biographyPlainDisplay(paragraph).split(/\n+/gu).map(line => line.trim()).filter(Boolean)
    return lines.map(line => {
      const heading = line.length <= 64 && /[:：]\s*$/u.test(line) && !/[.!؟؛،]/u.test(line.slice(0, -1))
      return { kind: heading ? 'heading' : 'paragraph', text: heading ? line.replace(/[:：]\s*$/u, '') : line } as BiographyContentBlock
    })
  })
}

export function peopleFacetMatches(value: string, requested: string): boolean {
  const left = normalizePeopleFacet(value), right = normalizePeopleFacet(requested)
  return Boolean(left && right && left === right)
}

export function peopleFacetHref(kind: PeopleFacetKind, value: string): string {
  return `#/authors?facet=${kind}&value=${encodeURIComponent(value)}`
}

export function filterTarajmFacetRecords(records: readonly TarajmFacetRecord[], kind: PeopleFacetKind, value: string): TarajmFacetRecord[] {
  return records.filter(record => {
    const values = kind === 'place' ? record.biography.places?.value : [...(record.biography.traits?.value??[]),...(record.biography.categories?.value??[])]
    return values?.some(item => peopleFacetMatches(item, value))
  })
}

export function uniquePeopleHrefByName(catalog: readonly Pick<ShamelaAuthorIndexEntry, 'authorId' | 'name'>[], name: string): string | undefined {
  const normalized = normalizePeopleFacet(name)
  if (!normalized) return undefined
  const targets = catalog.filter(author => normalizePeopleFacet(author.name) === normalized)
  return targets.length === 1 ? peopleHref(targets[0]!.authorId) : undefined
}

/**
 * Resolve a scientific relation to a library-local people page only.
 *
 * An audited Tarajm id mapping is the strongest evidence.  When it is not
 * available we accept an exact normalized name only when it identifies one
 * (and only one) author in the local catalog.  Ambiguous and missing names
 * deliberately stay plain text; this prevents plausible-looking but wrong
 * links and keeps author pages usable without any external website.
 */
export function internalRelationPeopleHref(
  catalog: readonly Pick<ShamelaAuthorIndexEntry, 'authorId' | 'name'>[],
  name: string,
  relation: BiographyRelation | undefined,
  peopleHrefByTarajmId: ReadonlyMap<string, string>,
): string | undefined {
  const auditedHref = relation?.tarajmExternalId ? peopleHrefByTarajmId.get(relation.tarajmExternalId) : undefined
  return auditedHref ?? uniquePeopleHrefByName(catalog, name)
}

const tarajmAssetTasks=new Map<string,Promise<unknown>>()
function fetchTarajmDataFile(fileName:string):Promise<unknown>{
 const existing=tarajmAssetTasks.get(fileName);if(existing)return existing
 const task=fetchTarajmDataFileUncached(fileName).catch(error=>{tarajmAssetTasks.delete(fileName);throw error})
 tarajmAssetTasks.set(fileName,task);return task
}
async function fetchTarajmDataFileUncached(fileName: string): Promise<unknown> {
  // Relative assets work both under the local server and in a packaged copy of
  // the library. Keep the root URL as a compatibility fallback for old shells.
  // The version is deliberately shared so an old cached empty bundle cannot
  // silently remove every Tarajm biography from author pages.
  const urls = [`./data/${fileName}?v=4`, `/data/${fileName}?v=4`]
  let lastError: unknown
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
      if (response.ok) return await response.json()
      lastError = new Error(`tarajm_data_unavailable:${fileName}:${response.status}`)
    } catch (error) { lastError = error }
  }
  throw lastError instanceof Error ? lastError : new Error(`tarajm_data_unavailable:${fileName}`)
}

async function fetchTarajmBiographies(): Promise<{ schemaVersion?: number; biographies?: Record<string, StructuredBiography> }> {
  try {
    const manifest = await fetchTarajmDataFile('tarajm-biographies.manifest.json') as { schemaVersion?: number; parts?: string[] }
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.parts) || manifest.parts.length === 0) {
      throw new Error('tarajm_biography_manifest_invalid')
    }
    const payloads = await Promise.all(manifest.parts.map(part => fetchTarajmDataFile(part))) as Array<{ schemaVersion?: number; biographies?: Record<string, StructuredBiography> }>
    const biographies: Record<string, StructuredBiography> = {}
    for (const payload of payloads) {
      if (payload.schemaVersion !== 1 || !payload.biographies || typeof payload.biographies !== 'object') {
        throw new Error('tarajm_biography_part_invalid')
      }
      Object.assign(biographies, payload.biographies)
    }
    return { schemaVersion: 1, biographies }
  } catch {
    // Development and older packaged copies still expose the historical
    // single-file bundle. Production releases prefer the bounded parts above.
    return await fetchTarajmDataFile('tarajm-biographies.json') as { schemaVersion?: number; biographies?: Record<string, StructuredBiography> }
  }
}

async function loadTarajmLocalData(): Promise<{ mappings: TarajmAuthorMapping[]; biographies: Record<string, StructuredBiography> }> {
  // Do not let a transient failure in one file discard the other file too. In
  // particular, preserving the mapping list keeps internal people links valid
  // while the biography bundle can be retried on the next page visit.
  const [mappingResult, biographyResult] = await Promise.allSettled([
    fetchTarajmDataFile('tarajm-author-map.json'),
    fetchTarajmBiographies(),
  ])
  const mapping = mappingResult.status === 'fulfilled' ? mappingResult.value as { mappings?: TarajmAuthorMapping[] } : undefined
  const biographies = biographyResult.status === 'fulfilled' ? biographyResult.value as { schemaVersion?: number; biographies?: Record<string, StructuredBiography> } : undefined
  const items = Array.isArray(mapping?.mappings) ? mapping.mappings.filter((item: TarajmAuthorMapping) => /^\d+$/u.test(item?.shamelaAuthorId ?? '') && /^\d+$/u.test(item?.tarajmExternalId ?? '')) : []
  return { mappings: items, biographies: biographies?.schemaVersion === 1 && biographies.biographies && typeof biographies.biographies === 'object' ? biographies.biographies : {} }
}

export async function loadLocalTarajmBiography(shamelaAuthorId: string, aliases: readonly string[] = [], deathYearHijri?: number): Promise<TarajmLocalBundle> {
  const map = await fetchTarajmDataFile('tarajm-author-map.json') as {mappings:TarajmAuthorMapping[]}
  const mapping = resolveAuditedTarajmMapping(map.mappings, { shamelaAuthorId, names: aliases, ...(deathYearHijri != null ? { deathYearHijri } : {}) })
  const peopleHrefByTarajmId = new Map(map.mappings.map(item => [item.tarajmExternalId, peopleHref(item.shamelaAuthorId)!]))
  // Unmapped authors already have their sourced Shamela narrative in the
  // author index; never download every Tarajm biography to establish absence.
  if(!mapping)return {peopleHrefByTarajmId}
  const manifest=await fetchTarajmDataFile('tarajm-persons.manifest.json') as {contract:string;generation:string;unavailableExternalIds?:string[];entries:Record<string,{path:string;bytes:number;sha256:string}>}
  const asset=manifest.entries?.[mapping.tarajmExternalId]
  if(manifest.contract==='tarajm-person-assets/1'&&!asset&&manifest.unavailableExternalIds?.includes(mapping.tarajmExternalId))return {peopleHrefByTarajmId}
  if(manifest.contract!=='tarajm-person-assets/1'||!/^[a-f0-9]{64}$/.test(manifest.generation)||!asset||asset.path!==`tarajm-persons/${manifest.generation}/${mapping.tarajmExternalId}.json`||asset.bytes>500_000)throw Error('tarajm_person_index_invalid')
  const payload=await fetchTarajmDataFile(asset.path) as {schemaVersion:number;biographies:Record<string,StructuredBiography>}
  const bytes=new TextEncoder().encode(JSON.stringify(payload)),digest=await crypto.subtle.digest('SHA-256',bytes),sha=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')
  if(bytes.length!==asset.bytes||sha!==asset.sha256||payload.schemaVersion!==1)throw Error('tarajm_person_integrity')
  const biography=validateStructuredBiography(payload.biographies[mapping.tarajmExternalId],'tarajm.com')
  return { ...(biography ? { biography: biographyForPresentation(biography) } : {}), peopleHrefByTarajmId }
}

export async function loadLocalTarajmFacetRecords(): Promise<TarajmFacetRecord[]> {
  return facetRecordsTask??=(async()=>{
    const response=await fetch(`./data/people-facets.json?v=${PEOPLE_FACETS_SHA}`,{cache:'force-cache',signal:AbortSignal.timeout(10000)})
    if(!response.ok)throw Error('people_facets_unavailable')
    const reader=response.body?.getReader();if(!reader)throw Error('people_facets_invalid')
    const parts:Uint8Array[]=[];let size=0
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1_000_000)throw Error('people_facets_budget');parts.push(value)}}finally{await reader.cancel();reader.releaseLock()}
    const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
    const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')
    if(sha!==PEOPLE_FACETS_SHA)throw Error('people_facets_integrity')
    const data=JSON.parse(new TextDecoder().decode(bytes)) as {contract:string;records:TarajmFacetRecord[]}
    if(data.contract!=='people-facets/1'||!Array.isArray(data.records))throw Error('people_facets_invalid')
    return data.records.map(record=>({...record,biography:biographyForPresentation(record.biography)}))
  })().catch(error=>{facetRecordsTask=undefined;throw error})
}
export const PEOPLE_FACETS_SHA='3120fcc058597a3a7d9190c000f800d5a7837cb866a6189d839069b5c6bab350'
let facetRecordsTask:Promise<TarajmFacetRecord[]>|undefined

export const TARAJM_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Tarajm integration deliberately stays opt-in. The production endpoint,
 * credentials and reuse terms must be documented before this provider is enabled.
 * The author page never waits for it: local data renders first, then an authorised
 * provider may refresh the cache in the background.
 */
export class TarajmBiographyProvider implements BiographyProvider {
  readonly id = 'tarajm.com'
  constructor(private readonly endpoint?: string, private readonly token?: string) {}
  async getByExternalId(externalId: string, signal?: AbortSignal): Promise<StructuredBiography | undefined> {
    if (!this.endpoint || !this.token || !/^\d+$/u.test(externalId)) return undefined
    const response = await fetch(`${this.endpoint.replace(/\/$/u, '')}/people/${encodeURIComponent(externalId)}`, {
      ...(signal ? { signal } : {}), headers: { Accept: 'application/json', Authorization: `Bearer ${this.token}` }, cache: 'no-store',
    })
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) return undefined
    const biography = validateStructuredBiography(await response.json(), 'tarajm.com')
    return biography?.tarajmExternalId === externalId ? biography : undefined
  }
}

export function tarajmBiographyCacheKey(externalId: string): string {
  return `alkhizana:tarajm-biography:v1:${externalId}`
}

export function readTarajmBiographyCache(externalId: string, storage: Pick<Storage, 'getItem'> = localStorage, now = Date.now()): StructuredBiography | undefined {
  if (!/^\d+$/u.test(externalId)) return undefined
  try {
    const value = JSON.parse(storage.getItem(tarajmBiographyCacheKey(externalId)) || 'null') as TarajmBiographyCacheRecord | null
    if (!value || value.schema !== 'alkhizana-tarajm-biography-cache' || value.version !== 1 || value.externalId !== externalId) return undefined
    const fetchedAt = Date.parse(value.fetchedAt)
    if (!Number.isFinite(fetchedAt) || now - fetchedAt > TARAJM_CACHE_TTL_MS) return undefined
    return validateStructuredBiography(value.biography, 'tarajm.com')
  } catch { return undefined }
}

export function writeTarajmBiographyCache(externalId: string, biography: StructuredBiography, storage: Pick<Storage, 'setItem'> = localStorage, now = Date.now()): boolean {
  if (!/^\d+$/u.test(externalId)) return false
  const verified = validateStructuredBiography(biography, 'tarajm.com')
  if (!verified) return false
  const record: TarajmBiographyCacheRecord = { schema: 'alkhizana-tarajm-biography-cache', version: 1, externalId, fetchedAt: new Date(now).toISOString(), biography: verified }
  try { storage.setItem(tarajmBiographyCacheKey(externalId), JSON.stringify(record)); return true } catch { return false }
}

export async function resolveTarajmBiography(externalId: string | undefined, provider: BiographyProvider | undefined, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage, signal?: AbortSignal): Promise<StructuredBiography | undefined> {
  if (!externalId || !/^\d+$/u.test(externalId)) return undefined
  const cached = readTarajmBiographyCache(externalId, storage)
  if (cached) return cached
  if (!provider || provider.id !== 'tarajm.com') return undefined
  const biography = await provider.getByExternalId(externalId, signal).catch(() => undefined)
  if (!biography || !validateStructuredBiography(biography, 'tarajm.com')) return undefined
  writeTarajmBiographyCache(externalId, biography, storage)
  return biography
}

export function peopleIdFromShamelaId(shamelaId: string | number): string | undefined {
  const value = String(shamelaId).trim()
  if (!/^\d{1,6}$/u.test(value) || Number(value) < 1) return undefined
  return value.padStart(PEOPLE_ROUTE_DIGITS, '0')
}

export function peopleHref(shamelaId: string | number): string | undefined {
  const id = peopleIdFromShamelaId(shamelaId)
  return id ? `#/people/${id}` : undefined
}

export function localPeopleHref(authorId: string): string | undefined {
  const id = authorId.trim()
  return id ? `#/people/${encodeURIComponent(`local:${id}`)}` : undefined
}

export function localAuthorIdFromPeopleId(peopleId: string): string | undefined {
  return peopleId.startsWith('local:') && peopleId.slice(6).trim() ? peopleId.slice(6) : undefined
}

export function shamelaIdFromPeopleId(peopleId: string): string | undefined {
  // shamela_pack_seed generates this exact source-ID namespace for book authors.
  // It is an identity alias, not a name-based match or a free-form local author.
  const generated=peopleId.match(/^local:shamela-author-([1-9]\d{0,5})$/u)
  if(generated)return generated[1]
  if (!/^\d{6}$/u.test(peopleId) || Number(peopleId) < 1) return undefined
  return String(Number(peopleId))
}

export function hijriAge(birthYear?: number, deathYear?: number): number | undefined {
  if (!Number.isInteger(birthYear) || !Number.isInteger(deathYear) || birthYear! < 1 || deathYear! < birthYear!) return undefined
  const age = deathYear! - birthYear!
  return age <= 150 ? age : undefined
}

export function resolvePeopleEntry(authors: ShamelaAuthorIndexEntry[], peopleId: string): ShamelaAuthorIndexEntry | undefined {
  const shamelaId = shamelaIdFromPeopleId(peopleId)
  return shamelaId ? authors.find(author => author.authorId === shamelaId) : undefined
}

/**
 * Builds a minimal, enrichable people entry when the biography index has no
 * row yet. A canonical route uses the exact book author id. A local route
 * created directly from a displayed book name may use that same exact
 * normalized name, without fuzzy matching. This keeps the book's author name
 * and an otherwise empty biography instead of presenting them as nonexistent.
 */
export function fallbackPeopleEntryFromBooks(peopleId: string, books: readonly StoredBook[]): ShamelaAuthorIndexEntry | undefined {
  const routeAuthorId = shamelaIdFromPeopleId(peopleId) ?? localAuthorIdFromPeopleId(peopleId)
  if (!routeAuthorId) return undefined
  const routeName = localAuthorIdFromPeopleId(peopleId)
  const normalizedRouteName = routeName ? normalizePeopleFacet(routeName) : ''
  const linkedById = books.filter(book => book.authorId === routeAuthorId || book.authors?.some(author => author.id === routeAuthorId))
  const linked = linkedById.length || !normalizedRouteName ? linkedById : books.filter(book => {
    const refs = book.authors?.length ? book.authors : [{ name: book.author }]
    return refs.some(author => normalizePeopleFacet(author.name) === normalizedRouteName)
  })
  if (!linked.length) return undefined
  const names = linked.flatMap(book => [
    ...(book.authorId === routeAuthorId ? [book.author] : []),
    ...(book.authors ?? []).filter(author => author.id === routeAuthorId).map(author => author.name),
    ...(!linkedById.length ? [book.author, ...(book.authors ?? []).map(author => author.name)] : []),
  ]).map(name => name.trim()).filter(name => name && (!normalizedRouteName || normalizePeopleFacet(name) === normalizedRouteName))
  const name = names[0] ?? routeName?.trim()
  if (!name) return undefined
  return {
    authorId: routeAuthorId,
    id: `book-fallback:${routeAuthorId}`,
    name,
    ...(displayableAuthorDeathYear(linked.find(book => displayableAuthorDeathYear(book.deathYearHijri) != null)?.deathYearHijri) != null ? { deathYearHijri: displayableAuthorDeathYear(linked.find(book => displayableAuthorDeathYear(book.deathYearHijri) != null)?.deathYearHijri)! } : {}),
    bookCount: linked.length,
    books: linked.map(book => ({ id: book.id, sourceBookId: book.sourceBookId || book.id, title: book.title, batchId: 'local' })),
  }
}

export function localStructuredBiography(entry: ShamelaAuthorIndexEntry, record?: StoredAuthor): StructuredBiography {
  // The canonical Shamela author index carries a fail-closed, source-bound
  // biography.  It is safe to show that prose when no richer audited Tarajm
  // record exists; unsourced prose from IndexedDB deliberately stays local and
  // is never promoted into the public biography.
  const routeId = peopleIdFromShamelaId(entry.authorId) ?? `local:${entry.id}`
  const source: BiographySource = { provider: 'local', sourceUrl: `local:people/${routeId}`, verifiedAt: '2026-08-12' }
  const result: StructuredBiography = { sources: [] }
  result.displayName = { ...source, value: entry.name }
  result.fullName = { ...source, value: entry.name }
  const parsed = entry.biography ? parseBiographyText(entry.biography) : undefined
  const deathYear = displayableAuthorDeathYear(parsed?.deathHijri || record?.deathYearHijri || entry.deathYearHijri)
  if (parsed?.birthHijri) result.birth = { ...source, value: { hijri: parsed.birthHijri, ...(parsed.birthGregorian ? { gregorian: parsed.birthGregorian } : {}) } }
  if (deathYear) result.death = { ...source, value: { hijri: deathYear, ...(parsed?.deathGregorian ? { gregorian: parsed.deathGregorian } : {}) } }
  if (entry.biography && entry.biographyProvenance?.provider === 'shamela.ws') {
    const shamelaSource: BiographySource = {
      provider: 'shamela.ws',
      sourceUrl: entry.biographyProvenance.sourceUrl,
      verifiedAt: '2026-08-08T15:52:38.813Z',
      citationTitle: 'صفحة المؤلف في المكتبة الشاملة',
    }
    const paragraphs = parsed?.paragraphs ?? biographyParagraphs(entry.biography)
    if (paragraphs.length) {
      result.summary = { ...shamelaSource, value: parsed?.text ?? entry.biography }
      result.sections = [{ title: 'الترجمة', paragraphs, source: shamelaSource }]
    }
  }
  result.sources = uniqueSources(Object.values(result).flatMap(value => sourceFromValue(value)))
  if (result.sections) result.sources = uniqueSources([...result.sources, ...result.sections.map(section => section.source)])
  return result
}

export function cleanBiographyText(value: string): string {
  return parseBiographyText(value).text
}

export function parseBiographyText(value: string): { text: string; reference?: string; birthHijri?: number; birthGregorian?: number; deathHijri?: number; deathGregorian?: number; reportedAge?: { years: number; approximate: boolean }; paragraphs: string[] } {
  let text = biographyPlainDisplay(value).replace(/&(?:times|nbsp);/giu, ' ')
    .replace(/(?:×|البحث في:|تنبيهات هامة:)[\s\S]*$/iu, '').replace(/\s+/gu, ' ').trim()
  const reactTail = /(?:\b(?:className|container|children)\b\s*[:=]|\$L[0-9a-z]+\b|self\.__next_f|__next_f|,\s*\\?"(?:students|masters|books|categories)\\?"\s*:)/iu.exec(text)
  if (reactTail) text = text.slice(0, reactTail.index).replace(/[\\"\}\]]+$/gu, '').trim()
  const sourceMatch = /\s+(?:نقلا\s+عن|المصدر)\s*:\s*([^\n]+?)\s*$/iu.exec(text)
  const reference = sourceMatch?.[1]?.replace(/[.،؛]+$/gu, '').trim()
  if (sourceMatch) text = text.slice(0, sourceMatch.index).trim()
  // Shamela uses 000/٠٠٠ as an explicit unknown year. Preserve only the known
  // death dates and never present the zero placeholder as a real birth date.
  text = text.replace(/\(\s*[٠0]{3}\s*-\s*([٠-٩0-9]+)\s*هـ\s*=\s*[٠0]{3}\s*-\s*([٠-٩0-9]+)\s*م\s*\)/gu, '(ت $1 هـ = $2 م)')
    .replace(/\(\s*[٠0]{3}\s*-\s*([٠-٩0-9]+)\s*هـ\s*\)/gu, '(ت $1 هـ)')
  text = text.replace(/\s+/gu, ' ').trim()
  const completeDates = /\(\s*([٠-٩0-9]+)\s*-\s*([٠-٩0-9]+)\s*هـ\s*=\s*([٠-٩0-9]+)\s*-\s*([٠-٩0-9]+)\s*م\s*\)/u.exec(text)
  const deathHijriRaw = completeDates?.[2] ?? /\(ت\s+([٠-٩0-9]+)\s*هـ/u.exec(text)?.[1]
  const deathGregorianRaw = /\(ت\s+[٠-٩0-9]+\s*هـ\s*=\s*([٠-٩0-9]+)\s*م\)/u.exec(text)?.[1]
  const ageRaw = /(?:عن|عاش)\s+(نحو\s+)?([٠-٩0-9]+)\s*(?:عاما|عامًا|سنة)/u.exec(text)
  const reportedAge = ageRaw?.[2] ? { years: arabicInteger(ageRaw[2]), approximate: Boolean(ageRaw[1]) } : undefined
  return { text, paragraphs: biographyParagraphs(text), ...(reference ? { reference } : {}), ...(completeDates?.[1] ? { birthHijri: arabicInteger(completeDates[1]) } : {}), ...(completeDates?.[3] ? { birthGregorian: arabicInteger(completeDates[3]) } : {}), ...(deathHijriRaw ? { deathHijri: arabicInteger(deathHijriRaw) } : {}), ...((completeDates?.[4] ?? deathGregorianRaw) ? { deathGregorian: arabicInteger((completeDates?.[4] ?? deathGregorianRaw)!) } : {}), ...(reportedAge?.years ? { reportedAge } : {}) }
}

export function mergeBiographyDate(primary: SourcedValue<{ hijri?: number; gregorian?: number; place?: string }> | undefined, fallback: SourcedValue<{ hijri?: number; gregorian?: number; place?: string }> | undefined): SourcedValue<{ hijri?: number; gregorian?: number; place?: string }> | undefined {
  if (!primary) return fallback
  if (!fallback || primary.value.hijri !== fallback.value.hijri || !fallback.value.gregorian) return primary
  const calculation = (primary.value as typeof primary.value & { calculation?: { approximate?: boolean } }).calculation
  if (primary.value.gregorian && !calculation?.approximate) return primary
  const value = { ...primary.value, gregorian: fallback.value.gregorian } as typeof primary.value & { calculation?: { approximate?: boolean } }
  // The local exact counterpart supersedes only the generated approximation;
  // preserving that flag would make an exact date look uncertain in the UI.
  if (calculation?.approximate) delete value.calculation
  return { ...primary, value }
}

/** يدمج المصدرين حقليًا؛ سجل Tarajm جزئي (تاريخ فقط مثلًا) لا يجوز أن يمحو
 * نص ترجمة الشاملة المسند. لا ينشئ هذا الربط أي هوية جديدة أو نصًا مولدًا. */
export function mergeStructuredBiography(primary:StructuredBiography|undefined,fallback:StructuredBiography):StructuredBiography {
  if(!primary)return fallback
  const merged={...fallback,...primary} as StructuredBiography
  const narrativeLength=(value:StructuredBiography):number=>[
    value.summary?.value,
    ...(value.sections??[]).flatMap(section=>section.paragraphs),
  ].filter(Boolean).join(' ').trim().length
  // A mapped provider record may contain only a heading, dash, or one-line
  // stub while the source-bound Shamela row carries the full narrative. Keep
  // Tarajm's structured fields, but never let a sub-100-character stub erase
  // a longer, independently sourced local biography.
  if(narrativeLength(primary)<100&&narrativeLength(fallback)>narrativeLength(primary)){
    if(fallback.summary)merged.summary=fallback.summary
    if(fallback.sections?.length)merged.sections=fallback.sections
  }
  const birth=mergeBiographyDate(primary.birth,fallback.birth),death=mergeBiographyDate(primary.death,fallback.death)
  if(birth)merged.birth=birth
  if(death)merged.death=death
  merged.sources=uniqueSources([...(primary.sources??[]),...(fallback.sources??[])])
  return merged
}

export function booksLinkedToPeople(entry: Pick<ShamelaAuthorIndexEntry, 'id' | 'authorId' | 'name'>, record: Pick<StoredAuthor, 'id'> | undefined, books: readonly StoredBook[]): StoredBook[] {
  const ids = new Set([entry.id, record?.id, entry.authorId].filter((value): value is string => Boolean(value)).map(canonicalAuthorIdentity))
  const fallbackName = entry.id.startsWith('book-fallback:') ? normalizePeopleFacet(entry.name) : ''
  return books.filter(book => {
    const refs = book.authors?.length ? book.authors : [{ name: book.author, ...(book.authorId ? { id: book.authorId } : {}) }]
    return refs.some(ref => Boolean(ref.id && ids.has(canonicalAuthorIdentity(ref.id))) || Boolean(fallbackName && normalizePeopleFacet(ref.name) === fallbackName))
  })
}

export function biographyParagraphs(text: string): string[] {
  const normalized = text.trim()
  if (!normalized) return []
  const dated = /^(.*?)\s*(\(ت\s+[^)]+\))\s*(.*)$/u.exec(normalized)
  const paragraphs: string[] = []
  let body = normalized
  if (dated) { paragraphs.push(`${dated[1]!.trim()} ${dated[2]!.trim()}`); body = dated[3]!.trim() }
  const markers = [...body.matchAll(/(?:^|\s)(?=(?:تفقه|له\s+\(|وله\s+\())/gu)].map(match => match.index! + match[0].length)
  const starts = [0, ...markers.filter(index => index > 0)]
  for (let index = 0; index < starts.length; index++) {
    const part = body.slice(starts[index], starts[index + 1] ?? body.length).trim()
    if (part) paragraphs.push(ensureFinalPunctuation(part))
  }
  return paragraphs.length ? paragraphs : [ensureFinalPunctuation(normalized)]
}

function arabicInteger(value: string): number {
  return Number(value.replace(/[٠-٩]/gu, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))))
}

function ensureFinalPunctuation(value: string): string {
  return /[.!؟؛:]$/u.test(value) ? value : `${value}.`
}

export function validateStructuredBiography(value: unknown, provider: BiographySource['provider']): StructuredBiography | undefined {
  if (!value || typeof value !== 'object') return undefined
  const item = value as StructuredBiography
  if (!Array.isArray(item.sources) || item.sources.some(source => !validSource(source, provider))) return undefined
  const sourced = [item.summary, item.displayName, item.fullName, item.knownAs, item.lineage, item.birth, item.death, item.reportedAge, item.places, item.teachers, item.students, item.teacherLinks, item.studentLinks, item.traits, item.categories, item.positions, item.works]
  if (sourced.some(field => field && !validSource(field, provider))) return undefined
  for (const links of [item.teacherLinks, item.studentLinks]) {
    if (!links) continue
    if (!Array.isArray(links.value) || links.value.some(link => !link || !/^\d+$/u.test(link.tarajmExternalId ?? '') || !link.name?.trim())) return undefined
  }
  if (item.sections?.some(section => !section.title?.trim() || !Array.isArray(section.paragraphs) || !validSource(section.source, provider))) return undefined
  if (provider === 'tarajm.com') {
    if (!/^\d+$/u.test(item.tarajmExternalId ?? '')) return undefined
    const expectedPath = `/people/${item.tarajmExternalId}`
    if (item.sources.some(source => new URL(source.sourceUrl).pathname.replace(/\/$/u, '') !== expectedPath)) return undefined
  }
  return item
}

function validSource(source: BiographySource, provider: BiographySource['provider']): boolean {
  if (!source || source.provider !== provider || !source.sourceUrl?.trim() || Number.isNaN(Date.parse(source.verifiedAt))) return false
  if (provider !== 'tarajm.com') return true
  try { const url = new URL(source.sourceUrl); return url.protocol === 'https:' && (url.hostname === 'tarajm.com' || url.hostname === 'www.tarajm.com') && /^\/people\/\d+\/?$/u.test(url.pathname) }
  catch { return false }
}

function sourceFromValue(value: unknown): BiographySource[] {
  if (!value || typeof value !== 'object' || !('provider' in value)) return []
  return [value as BiographySource]
}

function uniqueSources(sources: BiographySource[]): BiographySource[] {
  const seen = new Set<string>()
  return sources.filter(source => { const key = `${source.provider}|${source.sourceUrl}`; if (seen.has(key)) return false; seen.add(key); return true })
}

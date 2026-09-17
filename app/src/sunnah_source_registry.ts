export type SunnahSourceKind = 'primary-book' | 'hadith-corpus' | 'verdicts' | 'narrators' | 'explanations' | 'translations'
export type SunnahStoragePolicy = 'bundled' | 'synchronized' | 'reference-only'

export interface SunnahSourceRelease {
  version: string
  retrievedAt: string
  checksumSha256: string
  manifestPath: string
}

export interface SunnahSourceRecord {
  id: string
  name: string
  homepage: string
  attributionLabel: string
  kind: SunnahSourceKind
  storagePolicy: SunnahStoragePolicy
  release?: SunnahSourceRelease
}

export interface SunnahProvenance {
  sourceId: string
  releaseVersion: string
  recordLocator: string
  recordChecksumSha256: string
}

/** إحالة إلى كتاب حديث أصلي؛ منفصلة عن مزود corpus الذي نقل النص والشرح. */
export interface SunnahPrimarySource {
  book: string
  bookId: number
  publicId: string
  hadithNumber: string
  volume: string
  page: string
  sequence: number
  provenance: {
    batchId: string
    bookPath: string
    bookSha256: string
    sourceRowId: string
    matchedExcerpt: string
    matchMethod: 'exact-number-and-normalized-text'
  }
}

export interface SunnahTakhrijAttribution {
  provider: string
  sourceUrl: string
  statement: string
}

export interface SunnahGoldenRecord {
  id: string
  title: string
  hadithText: string
  explanation: string
  wordMeanings: string
  benefits: string
  grade: string
  takhrij: string
  link: string
  provenance: SunnahProvenance
  primarySources?: SunnahPrimarySource[]
  takhrijAttribution?: SunnahTakhrijAttribution
}

export interface SunnahCorpusManifest {
  schemaVersion: number
  id: string
  language: string
  title: string
  publisher: string
  homepage: string
  downloadUrl: string
  checkForUpdatesUrl: string
  termsUrl: string
  release: {
    version: string
    sourceUpdatedAt: string
    retrievedAt: string
    sourceFile: string
    sourceFileSha256: string
  }
  selection: {
    strategy: string
    worksheet: string
    firstRow: number
    lastRow: number
    recordCount: number
  }
  records: { path: string; checksumSha256: string; count: number }
  attribution: string
}

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/

export const HADEETHENC_AR_SOURCE: SunnahSourceRecord = {
  id: 'hadeethenc-ar',
  name: 'موسوعة الأحاديث النبوية — العربية',
  homepage: 'https://hadeethenc.com/ar',
  attributionLabel: 'النصوص والشروح والفوائد من HadeethEnc.com مع إبقاء رقم الإصدار وعزو كل سجل.',
  kind: 'hadith-corpus',
  storagePolicy: 'bundled',
  release: {
    version: 'v1.7.0',
    retrievedAt: '2026-08-10T09:55:00Z',
    checksumSha256: 'd5d397cb9fc8ddd54c4c6ee88357c2217721db0bd0759c6ec26d8b3fc36f1ec1',
    manifestPath: '/sunnah/hadeethenc-ar/manifest.json',
  },
}

export const SUNNAH_SOURCES: readonly SunnahSourceRecord[] = [HADEETHENC_AR_SOURCE]

function validHttpsUrl(value: string): boolean {
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

export function validateSunnahSource(source: SunnahSourceRecord): string[] {
  const errors: string[] = []
  if (!ID_PATTERN.test(source.id)) errors.push('معرف المصدر غير صالح')
  if (!source.name.trim()) errors.push('اسم المصدر مطلوب')
  if (!validHttpsUrl(source.homepage)) errors.push('رابط المصدر يجب أن يكون HTTPS')
  if (!source.attributionLabel.trim()) errors.push('عبارة العزو في صفحة المصدر مطلوبة')
  if (source.release) {
    if (!source.release.version.trim()) errors.push('إصدار المصدر مطلوب')
    if (!Number.isFinite(Date.parse(source.release.retrievedAt))) errors.push('تاريخ جلب المصدر غير صالح')
    if (!SHA256_PATTERN.test(source.release.checksumSha256)) errors.push('بصمة إصدار المصدر غير صالحة')
    if (!source.release.manifestPath.startsWith('/') || source.release.manifestPath.includes('..'))
      errors.push('مسار manifest المصدر غير صالح')
  } else if (source.storagePolicy !== 'reference-only') {
    errors.push('المصدر المحلي أو المتزامن يحتاج إصدارًا وبصمة manifest')
  }
  return errors
}

export function validateSunnahProvenance(
  provenance: SunnahProvenance,
  sources: readonly SunnahSourceRecord[],
): string[] {
  const errors: string[] = []
  const source = sources.find(item => item.id === provenance.sourceId)
  if (!source) return ['المصدر المشار إليه غير مسجل']
  if (!source.release) return ['المصدر لا يملك إصدارًا محليًا موثقًا']
  if (provenance.releaseVersion !== source.release.version) errors.push('إصدار الشاهد لا يطابق إصدار المصدر')
  if (!provenance.recordLocator.trim()) errors.push('موضع الشاهد داخل المصدر مطلوب')
  if (!SHA256_PATTERN.test(provenance.recordChecksumSha256)) errors.push('بصمة سجل الشاهد غير صالحة')
  return errors
}

export function sourcePageHref(sourceId: string): string {
  return `#/sunnah/source/${encodeURIComponent(sourceId)}`
}

export function validateSunnahGoldenRecord(
  record: SunnahGoldenRecord,
  sources: readonly SunnahSourceRecord[] = SUNNAH_SOURCES,
): string[] {
  const errors = validateSunnahProvenance(record.provenance, sources)
  if (!record.id.trim()) errors.push('معرف الشاهد مطلوب')
  if (!record.title.trim() || !record.hadithText.trim()) errors.push('عنوان الشاهد ومتنه مطلوبان')
  const expectedLink = `https://hadeethenc.com/ar/browse/hadith/${encodeURIComponent(record.id)}`
  if (record.link !== expectedLink) errors.push('رابط الشاهد لا يطابق معرفه في المصدر')
  const primarySources = verifiedPrimarySources(record)
  if ((record.primarySources?.length || record.takhrijAttribution) && !primarySources.length)
    errors.push('إحالات المصادر الأصلية ناقصة التوثيق')
  return errors
}

/** fail-closed: لا ترجع إحالة واحدة ما لم يكتمل عزو المجموعة كلها. */
export function verifiedPrimarySources(record: Pick<SunnahGoldenRecord, 'primarySources' | 'takhrijAttribution'>): SunnahPrimarySource[] {
  const sources = record.primarySources
  const attribution = record.takhrijAttribution
  if (!sources?.length || !attribution?.provider.trim() || !attribution.statement.trim() || !validHttpsUrl(attribution.sourceUrl)) return []
  if (sources.some(source => !source.book.trim()
    || !Number.isSafeInteger(source.bookId) || source.bookId < 1
    || source.publicId !== String(410000000 + source.bookId)
    || !/^\d+(?:\s*[-–]\s*\d+)?$/u.test(source.hadithNumber.trim())
    || !source.volume.trim() || !source.page.trim()
    || !Number.isSafeInteger(source.sequence) || source.sequence < 0
    || !/^batch-\d{4}$/u.test(source.provenance.batchId)
    || source.provenance.bookPath !== `${source.provenance.batchId}/books/${source.bookId}.json`
    || !SHA256_PATTERN.test(source.provenance.bookSha256)
    || !source.provenance.sourceRowId.trim()
    || source.provenance.matchedExcerpt.trim().length < 20
    || source.provenance.matchMethod !== 'exact-number-and-normalized-text')) return []
  return sources
}

export function validateSunnahCorpusManifest(
  manifest: SunnahCorpusManifest,
  source: SunnahSourceRecord,
): string[] {
  const errors: string[] = []
  if (manifest.schemaVersion !== 1) errors.push('إصدار مخطط corpus غير مدعوم')
  if (manifest.id !== source.id) errors.push('معرف manifest لا يطابق المصدر')
  if (!source.release || manifest.release.version !== source.release.version) errors.push('إصدار manifest لا يطابق المصدر')
  if (!SHA256_PATTERN.test(manifest.release.sourceFileSha256)
    || manifest.release.sourceFileSha256 !== source.release?.checksumSha256)
    errors.push('بصمة ملف المصدر لا تطابق الإصدار المسجل')
  if (!Number.isFinite(Date.parse(manifest.release.sourceUpdatedAt))
    || !Number.isFinite(Date.parse(manifest.release.retrievedAt))) errors.push('تواريخ إصدار corpus غير صالحة')
  if (!Number.isInteger(manifest.records.count) || manifest.records.count < 1 || manifest.records.count > 50
    || manifest.records.count !== manifest.selection.recordCount) errors.push('عدد سجلات العينة الذهبية غير صالح')
  if (!manifest.records.path.startsWith('./') || manifest.records.path.includes('..')) errors.push('مسار سجلات corpus غير صالح')
  if (!SHA256_PATTERN.test(manifest.records.checksumSha256)) errors.push('بصمة سجلات corpus غير صالحة')
  if (![manifest.homepage, manifest.downloadUrl, manifest.checkForUpdatesUrl, manifest.termsUrl].every(validHttpsUrl))
    errors.push('روابط المصدر أو التنزيل أو التحديث أو الشروط غير صالحة')
  if (!manifest.attribution.trim()) errors.push('عزو corpus مطلوب')
  return errors
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export type VerifiedSunnahCorpus = { manifest: SunnahCorpusManifest; records: SunnahGoldenRecord[] }
type CachedVerifiedSunnahCorpus = VerifiedSunnahCorpus & { rawRecordsText?: string }

const sunnahCorpusMemory = new Map<string, VerifiedSunnahCorpus>()
const sunnahCorpusInflight = new Map<string, Promise<VerifiedSunnahCorpus>>()
const SUNNAH_CORPUS_CACHE = 'alkhizana-sunnah-corpus-v1'

function corpusCacheKey(source: SunnahSourceRecord): string {
  return `${source.id}:${source.release?.version ?? 'missing'}`
}

async function validateCorpusPayload(source: SunnahSourceRecord, manifest: SunnahCorpusManifest, recordsText: string): Promise<VerifiedSunnahCorpus> {
  const manifestErrors = validateSunnahCorpusManifest(manifest, source)
  if (manifestErrors.length) throw new Error(manifestErrors.join('، '))
  if (await sha256Hex(recordsText) !== manifest.records.checksumSha256) throw new Error('بصمة سجلات corpus لا تطابق manifest')
  const records = JSON.parse(recordsText) as SunnahGoldenRecord[]
  if (records.length !== manifest.records.count) throw new Error('عدد السجلات لا يطابق manifest')
  const ids = new Set<string>()
  for (const record of records) {
    const errors = validateSunnahGoldenRecord(record, [source])
    if (errors.length) throw new Error(errors.join('، '))
    if (ids.has(record.id)) throw new Error('تكرر معرف شاهد في corpus')
    ids.add(record.id)
  }
  return { manifest, records }
}

async function fetchVerifiedSunnahCorpus(source: SunnahSourceRecord, fetcher: typeof fetch): Promise<CachedVerifiedSunnahCorpus> {
  const manifestResponse = await fetcher(source.release!.manifestPath, { cache: 'no-store' })
  if (!manifestResponse.ok) throw new Error('تعذّر تحميل manifest المصدر')
  const manifest = await manifestResponse.json() as SunnahCorpusManifest
  const recordsUrl = new URL(manifest.records.path, new URL(source.release!.manifestPath, location.origin))
  const recordsResponse = await fetcher(recordsUrl, { cache: 'no-store' })
  if (!recordsResponse.ok) throw new Error('تعذّر تحميل سجلات corpus')
  const rawRecordsText = await recordsResponse.text()
  return { ...await validateCorpusPayload(source, manifest, rawRecordsText), rawRecordsText }
}

async function readPersistentSunnahCorpus(source: SunnahSourceRecord): Promise<VerifiedSunnahCorpus | undefined> {
  if (typeof caches === 'undefined' || typeof location === 'undefined') return undefined
  const response = await (await caches.open(SUNNAH_CORPUS_CACHE)).match(new Request(`${location.origin}/__alkhizana/sunnah/${encodeURIComponent(corpusCacheKey(source))}`))
  if (!response?.ok) return undefined
  try {
    const stored = await response.json() as { manifest: SunnahCorpusManifest; recordsText: string }
    return await validateCorpusPayload(source, stored.manifest, stored.recordsText)
  } catch { return undefined }
}

async function writePersistentSunnahCorpus(source: SunnahSourceRecord, corpus: VerifiedSunnahCorpus): Promise<void> {
  if (typeof caches === 'undefined' || typeof location === 'undefined') return
  const recordsText = (corpus as CachedVerifiedSunnahCorpus).rawRecordsText
  if (!recordsText) return
  const request = new Request(`${location.origin}/__alkhizana/sunnah/${encodeURIComponent(corpusCacheKey(source))}`)
  await (await caches.open(SUNNAH_CORPUS_CACHE)).put(request, new Response(JSON.stringify({ manifest: corpus.manifest, recordsText }), { headers: { 'content-type': 'application/json' } }))
}

function refreshSunnahCorpus(source: SunnahSourceRecord, fetcher: typeof fetch): Promise<VerifiedSunnahCorpus> {
  const key = corpusCacheKey(source), existing = sunnahCorpusInflight.get(key)
  if (existing) return existing
  const task = fetchVerifiedSunnahCorpus(source, fetcher).then(corpus => {
    sunnahCorpusMemory.set(key, corpus)
    if (fetcher === globalThis.fetch) void writePersistentSunnahCorpus(source, corpus).catch(() => undefined)
    return corpus
  }).finally(() => sunnahCorpusInflight.delete(key))
  sunnahCorpusInflight.set(key, task)
  return task
}

export async function loadVerifiedSunnahCorpus(
  source: SunnahSourceRecord = HADEETHENC_AR_SOURCE,
  fetcher: typeof fetch = fetch,
): Promise<VerifiedSunnahCorpus> {
  const sourceErrors = validateSunnahSource(source)
  if (sourceErrors.length || !source.release) throw new Error(sourceErrors.join('، ') || 'إصدار المصدر مفقود')
  const key = corpusCacheKey(source), memory = sunnahCorpusMemory.get(key)
  if (memory) { void refreshSunnahCorpus(source, fetcher).catch(() => undefined); return memory }
  if (fetcher === globalThis.fetch) {
    const persisted = await readPersistentSunnahCorpus(source)
    if (persisted) {
      sunnahCorpusMemory.set(key, persisted)
      void refreshSunnahCorpus(source, fetcher).catch(() => undefined)
      return persisted
    }
  }
  return refreshSunnahCorpus(source, fetcher)
}

export function preloadVerifiedSunnahCorpus(): void {
  void loadVerifiedSunnahCorpus().catch(() => undefined)
}

if (typeof window !== 'undefined') queueMicrotask(preloadVerifiedSunnahCorpus)

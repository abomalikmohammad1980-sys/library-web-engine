/** Permanent shared dictionaries. Network reads never submit source text. */
type Kind = 'ui' | 'book' | 'author'
type Row = readonly [string, string, string, boolean]
type Pack = { contract: string; locale: string; kind: Kind; shard: string; generation: number; rows: Row[] }
type Entry = { rows: Map<string, Row>; generation: number; expires: number; pending?: Promise<void> }
const packs = new Map<string, Entry>()
const hashes = new Map<string, string>()
const pendingHashes = new Set<string>()
const normalize = (v: string): string => v.normalize('NFC').replace(/\s+/gu, ' ').trim()
let timer: ReturnType<typeof setTimeout> | undefined
function signal(): void {
 if (typeof window === 'undefined') return
 if (timer) clearTimeout(timer)
 timer = setTimeout(() => window.dispatchEvent(new Event('khzanah:locales-ready')), 100)
}
function valid(p: unknown, locale: string, kind: Kind, shard: string): p is Pack {
 if (!p || typeof p !== 'object') return false
 const v = p as Partial<Pack>
 return v.contract === 'khzanah-localization/1' && v.locale === locale && v.kind === kind && v.shard === shard && Number.isSafeInteger(v.generation) && Array.isArray(v.rows) && v.rows.length <= 25000 && v.rows.every(r => Array.isArray(r) && r.length === 4 && typeof r[0] === 'string' && typeof r[1] === 'string' && typeof r[2] === 'string' && typeof r[3] === 'boolean' && r[2].length <= 16000)
}
function enabled(): boolean { return typeof document !== 'undefined' && document.querySelector('meta[name="khzanah-localization"][content="v1"]') !== null }
function entry(locale: string, kind: Kind, shard: string): Entry {
 const key = `${locale}/${kind}/${shard}`
 let e = packs.get(key)
 if (!e) { e = { rows: new Map(), generation: -1, expires: 0 }; packs.set(key, e) }
 if (!enabled() || e.pending || e.expires > Date.now()) return e
 const current = e
 current.pending = (async () => {
  try {
   const r = await fetch(`/api/localization/v1/dict/${key}.json`, { credentials: 'omit', signal: AbortSignal.timeout(6000) })
   if (!r.ok) { await r.body?.cancel(); current.expires = Date.now() + 60000; return }
   const reader = r.body?.getReader()
   if (!reader) throw Error('empty_dictionary')
   const chunks: Uint8Array[] = []; let size = 0
   try { while (true) { const v = await reader.read(); if (v.done) break; size += v.value.length; if (size > 4000000) { await reader.cancel(); throw Error('dictionary_limit') }; chunks.push(v.value) } } finally { reader.releaseLock() }
   const bytes = new Uint8Array(size); let at = 0
   for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length }
   const pack: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
   if (!valid(pack, locale, kind, shard)) throw Error('invalid_dictionary')
   if (pack.generation > current.generation) {
    const rows = new Map<string, Row>()
    for (const row of pack.rows) {
     const id = kind === 'ui' ? normalize(row[1]) : row[0]
     if (rows.has(id) && rows.get(id)?.[2] !== row[2]) throw Error('ambiguous_dictionary')
     rows.set(id, row)
    }
    current.rows = rows; current.generation = pack.generation; signal()
   }
   current.expires = Date.now() + 60000
  } catch { current.expires = Date.now() + 60000 }
  finally { current.pending = undefined }
 })()
 return current
}
export function permanentUiLabel(source: string, locale: string): string | undefined {
 if (locale === 'ar' || !/^[a-z]{2,3}$/.test(locale) || !enabled()) return undefined
 return entry(locale, 'ui', '0').rows.get(normalize(source))?.[2]
}
export function permanentCatalogLabel(kind: 'book' | 'author', id: string, source: string, locale: string): string | undefined {
 if (!enabled() || !id || locale === 'ar' || !/^[a-z]{2,3}$/.test(locale)) return undefined
 const shard = hashes.get(id)
 if (!shard) {
  if (!pendingHashes.has(id)) {
   pendingHashes.add(id)
   void crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)).then(bytes => { hashes.set(id, new Uint8Array(bytes)[0].toString(16).padStart(2, '0')[0]); signal() }).catch(() => undefined).finally(() => pendingHashes.delete(id))
  }
  return undefined
 }
 const row = entry(locale, kind, shard).rows.get(id)
 return row && normalize(row[1]) === normalize(source) ? row[2] : undefined
}
if (typeof window !== 'undefined') {
 window.addEventListener('khzanah:locales-ready', () => {
  // Existing observer keeps book bodies, private data and template parameters protected.
  void import('./translation').then(m => m.restoreSelectedSiteLanguage()).catch(() => undefined)
 })
 window.setInterval(() => {
  if (!enabled() || document.visibilityState === 'hidden') return
  let locale: string
  try { locale = localStorage.getItem('khizana:site-language') || 'ar' } catch { return }
  for (const key of packs.keys()) { const [lang, kind, shard] = key.split('/'); if (lang === locale) entry(lang, kind as Kind, shard) }
 }, 60000)
}

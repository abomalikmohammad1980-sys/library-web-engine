import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { parseSurahpediaJsonEnvelope, parseSurahpediaWordPage } from '../packages/source-sync/dist/surahpedia-word-resource.js'

const workspace = resolve(import.meta.dirname, '..')
const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('='); return [key, rest.join('=')]
}))
const projectId = Number(args.project)
const projects = {
  22: { kind: 'irab', slug: 'surahpedia-irab-word', title: 'إعراب القرآن الكريم على مستوى الكلمة' },
  36: { kind: 'qiraat', slug: 'surahpedia-qiraat-word', title: 'بيان القراءات على مستوى الكلمة' },
  37: { kind: 'tasrif', slug: 'surahpedia-tasrif-word', title: 'تصريف كلمات القرآن' },
}
const definition = projects[projectId]
if (!definition) throw Error('usage: --project=22|36|37 [--from=1] [--to=6236]')
const from = Number(args.from ?? 1), to = Number(args.to ?? 6236)
if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to > 6236 || from > to) throw Error('invalid_page_range')

const outputRoot = resolve(workspace, 'app', 'public', 'quran', 'resources', 'packs', definition.slug)
const stagingRoot = resolve(workspace, '..', '..', 'generated', 'surahpedia-word-resources', definition.slug)
await mkdir(outputRoot, { recursive: true }); await mkdir(stagingRoot, { recursive: true })
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const sleep = ms => new Promise(done => setTimeout(done, ms))
const officialJson = raw => {
  const start = raw.search(/\{\s*"title"\s*:/)
  if (start < 0) throw Error('surahpedia_json_envelope_missing')
  return raw.slice(start)
}
async function fetchText(url, headers = {}) {
  let last
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'AlKhizana-Waqf-Resource-Sync/1.0', ...headers } })
      if (!response.ok) throw Error(`HTTP_${response.status}`)
      const raw = await response.text()
      if (raw.length > 2_000_000) throw Error('surahpedia_response_too_large')
      return raw
    } catch (error) { last = error; await sleep(700 * 2 ** attempt) }
  }
  throw last
}

const indexRaw = await fetchText('https://surahpedia.com/api/suras')
const indexStart = indexRaw.indexOf('[')
if (indexStart < 0) throw Error('surahpedia_surah_index_missing')
const suras = JSON.parse(indexRaw.slice(indexStart))
if (!Array.isArray(suras) || suras.length !== 114) throw Error('surahpedia_surah_index_invalid')
const identities = new Map()
for (const surah of suras) {
  if (!Number.isSafeInteger(surah.id) || surah.id < 1 || surah.id > 114 || !surah.ayas || typeof surah.ayas !== 'object') throw Error('surahpedia_surah_index_invalid')
  for (const [pageText, ayahValue] of Object.entries(surah.ayas)) {
    const page = Number(pageText), ayah = Number(ayahValue)
    if (!Number.isSafeInteger(page) || !Number.isSafeInteger(ayah) || identities.has(page)) throw Error('surahpedia_page_index_invalid')
    identities.set(page, { page, surah: surah.id, ayah })
  }
}
if (identities.size !== 6236 || !identities.has(1) || !identities.has(6236)) throw Error(`surahpedia_page_index_coverage:${identities.size}`)

const collected = []
for (let page = from; page <= to; page++) {
  const identity = identities.get(page)
  if (!identity) throw Error(`surahpedia_page_identity_missing:${page}`)
  const stagingFile = join(stagingRoot, `${page}.json`)
  let normalized, fetched = false
  try {
    normalized = await readFile(stagingFile, 'utf8')
    parseSurahpediaWordPage(normalized, projectId, identity)
  } catch {
    const raw = await fetchText(`https://surahpedia.com/ar/projects/${projectId}/${page}`, { 'x-requested-with': 'XMLHttpRequest' })
    normalized = officialJson(raw)
    parseSurahpediaJsonEnvelope(normalized)
    await writeFile(stagingFile, normalized)
    fetched = true
  }
  const parsed = parseSurahpediaWordPage(normalized, projectId, identity)
  collected.push({ ...parsed, sourceChecksumSha256: sha256(Buffer.from(normalized)) })
  if ((page - from + 1) % 25 === 0 || page === to) process.stdout.write(`\r${page}/${to}`)
  if (fetched) await sleep(80)
}

const complete = from === 1 && to === 6236
if (!complete) {
  process.stdout.write(`\nverified ${collected.length} pages; partial audit only, app pack not replaced\n`)
  process.exit(0)
}
const bySurah = new Map()
for (const page of collected) {
  const records = bySurah.get(page.surah) ?? []
  records.push({ ayah: page.ayah, from: page.ayah, to: page.ayah, text: page.entries.map(entry => `${entry.word}: ${entry.text}`).join('\n\n'), words: page.entries })
  bySurah.set(page.surah, records)
}
const files = []
for (let surah = 1; surah <= 114; surah++) {
  const records = (bySurah.get(surah) ?? []).sort((a, b) => a.ayah - b.ayah)
  const bytes = Buffer.from(JSON.stringify({ schemaVersion: 2, resourceId: String(projectId), kind: definition.kind, slug: definition.slug, title: definition.title, author: 'الفريق العلمي بمركز تفسير للدراسات القرآنية', surah, records }))
  const file = `${surah}.json`; await writeFile(join(outputRoot, file), bytes)
  files.push({ surah, file, ayahs: records.length, words: records.reduce((sum, record) => sum + record.words.length, 0), byteSize: bytes.length, checksumSha256: sha256(bytes) })
}
const manifest = {
  schemaVersion: 2, datasetId: `surahpedia-${definition.kind}-word-v1`, dataVersion: new Date().toISOString(),
  resource: { id: String(projectId), kind: definition.kind, slug: definition.slug, title: definition.title, author: 'الفريق العلمي بمركز تفسير للدراسات القرآنية' },
  coverage: 'complete', counts: { surahs: 114, ayahs: collected.length, words: collected.reduce((sum, page) => sum + page.entries.length, 0) },
  mapping: { pageIndex: 'GET /api/suras -> suras[].ayas[page]=ayah', content: 'validated JSON html word anchors and following text', rangeMode: 'exact-single-ayah-word' },
  provenance: { provider: 'موسوعة سورة — مركز تفسير للدراسات القرآنية', sourceTemplate: `https://surahpedia.com/ar/projects/${projectId}/{page}`, retrievedAt: new Date().toISOString(), permissionBasis: 'USER-ATTESTED-WAQF-REUSE (2026-08-10)', indexChecksumSha256: sha256(Buffer.from(indexRaw.slice(indexStart))) },
  files,
}
await writeFile(join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
process.stdout.write(`\n${JSON.stringify(manifest.counts)}\n`)

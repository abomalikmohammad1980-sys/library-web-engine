import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const workspace = resolve(import.meta.dirname, '..')
const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('='); return [key, rest.join('=')]
}))
const id = Number(args.id), slug = String(args.slug ?? ''), title = String(args.title ?? ''), author = String(args.author ?? '') || null
const kind = String(args.kind ?? 'tafsir')
const coverage = String(args.coverage ?? 'complete')
if (!Number.isSafeInteger(id) || id < 1 || !/^[a-z0-9-]+$/.test(slug) || !title || !['tafsir', 'gharib', 'qiraat', 'irab'].includes(kind))
  throw Error('usage: --id=N --slug=ascii-slug --title=Arabic [--author=Arabic] [--kind=tafsir|gharib|qiraat|irab]')
if (!['complete', 'partial'].includes(coverage)) throw Error('coverage_must_be_complete_or_partial')

const outputRoot = resolve(workspace, 'app', 'public', 'quran', 'resources', 'packs', slug)
const stagingRoot = resolve(workspace, '..', '..', 'generated', 'quran-verse-resources', slug)
await mkdir(outputRoot, { recursive: true }); await mkdir(stagingRoot, { recursive: true })
const corpus = JSON.parse(await readFile(resolve(workspace, 'app', 'public', 'quran', 'full', 'ayah-text.json'), 'utf8'))
const expected = new Map()
for (const row of corpus.records ?? []) expected.set(Number(row.surah), Math.max(expected.get(Number(row.surah)) ?? 0, Number(row.ayah)))
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const decode = value => value
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([a-f0-9]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;|&#039;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const text = html => decode(html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p\s*>/gi, '\n').replace(/<[^>]+>/g, ' '))
  .replace(/[ \t\f\v]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
async function fetchPage(url) {
  let last
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { headers: { accept: 'text/html', 'user-agent': 'Khizana-Waqf-Resource-Sync/1.0' } })
      if (!response.ok) throw Error(`HTTP_${response.status}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (error) { last = error; await sleep(500 * 2 ** attempt) }
  }
  throw last
}
const files = [], sourcePages = []
for (let surah = 1; surah <= 114; surah++) {
  // Route shape is `/surah/{selectedAyah}/{surah}/book/{book}`. Always select
  // ayah 1; reversing both numbers silently renders another surah or tajweed.
  const url = `https://quranpedia.net/surah/1/${surah}/book/${id}`
  const stagingFile = join(stagingRoot, `${surah}.html`)
  let bytes
  try { bytes = await readFile(stagingFile) } catch { bytes = await fetchPage(url); await writeFile(stagingFile, bytes) }
  const html = bytes.toString('utf8'), articles = [...html.matchAll(/<article class="verse-block"[\s\S]*?<\/article>/gi)]
  const extracted = []
  for (const match of articles) {
    const article = match[0], ayahMatch = /<a\b[^>]*\bayah="(\d+)"[^>]*\bsurah="(\d+)"/i.exec(article)
    const tafsirMatch = /<div class="tafsir-content[^>]*>[\s\S]*?<div class="prose[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/article>/i.exec(article)
    if (!ayahMatch) throw Error(`resource_markup_unrecognized:${surah}`)
    if (!tafsirMatch) continue
    const ayah = Number(ayahMatch[1]), linkedSurah = Number(ayahMatch[2]), body = text(tafsirMatch[1])
    if (linkedSurah !== surah) throw Error(`resource_surah_mismatch:${surah}:${linkedSurah}`)
    if (!body) throw Error(`resource_empty_text:${surah}:${ayah}`)
    extracted.push({ ayah, from: ayah, to: ayah, text: body })
  }
  const records = [...extracted.reduce((map, record) => {
    const previous = map.get(record.ayah)
    map.set(record.ayah, previous ? { ...previous, text: `${previous.text}\n\n${record.text}` } : record)
    return map
  }, new Map()).values()].sort((a, b) => a.ayah - b.ayah)
  const expectedCount = expected.get(surah)
  const exactComplete = records.length === expectedCount && records.every((record, index) => record.ayah === index + 1)
  const exactPartial = records.every((record, index) => record.ayah >= 1 && record.ayah <= expectedCount && (index === 0 || records[index - 1].ayah < record.ayah))
  if ((coverage === 'complete' && !exactComplete) || (coverage === 'partial' && !exactPartial))
    throw Error(`resource_exact_ayah_coverage_failed:${surah}:${records.length}/${expectedCount}`)
  const payload = Buffer.from(JSON.stringify({ schemaVersion: 1, resourceId: String(id), kind, slug, title, author, surah, records }))
  const file = `${surah}.json`; await writeFile(join(outputRoot, file), payload)
  files.push({ surah, file, ayahs: records.length, byteSize: payload.length, checksumSha256: sha256(payload) })
  sourcePages.push({ surah, url, byteSize: bytes.length, checksumSha256: sha256(bytes) })
  process.stdout.write(`\r${surah}/114`)
}
const manifest = {
  schemaVersion: 1, datasetId: `quranpedia-exact-verse-resource-${slug}`, dataVersion: new Date().toISOString(),
  resource: { id: String(id), kind, slug, title, author }, coverage, counts: { surahs: files.length, ayahs: files.reduce((sum, file) => sum + file.ayahs, 0) },
  mapping: { content: 'article.verse-block .tafsir-content .prose', ayah: 'article a.ayah#verse-{ayah}', rangeMode: 'exact-single-ayah' },
  provenance: { provider: 'Quranpedia', sourceTemplate: `https://quranpedia.net/surah/1/{surah}/book/${id}`, retrievedAt: new Date().toISOString(), permissionBasis: 'USER-ATTESTED-WAQF-REUSE', sourcePages },
  files,
}
await writeFile(join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
process.stdout.write(`\n${JSON.stringify(manifest.counts)}\n`)

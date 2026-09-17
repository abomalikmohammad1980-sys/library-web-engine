import { cp, mkdir, open, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '../../app')
const source = resolve(appRoot, 'public')
const destination = process.env.ALKHIZANA_UI_STAGE_DESTINATION
  ? resolve(process.env.ALKHIZANA_UI_STAGE_DESTINATION)
  : resolve(appRoot, 'dist')

const roots = [
  '.well-known', 'fonts', 'icons', 'pdfjs', 'quran', 'sunnah',
  'brand-logo-color.png', 'brand-logo-mono.png', 'favicon-64.png',
  'favicon.svg', 'manifest.webmanifest', 'robots.txt', 'sw.js',
]

for (const name of roots) await cp(resolve(source, name), resolve(destination, name), { recursive: true, force: true })
for (const name of ['_headers', '_redirects']) await cp(resolve(here, 'pages-static', name), resolve(destination, name), { force: true })

await mkdir(resolve(destination, 'data'), { recursive: true })
for (const name of ['shamela-authors.json', 'author-supplement.json']) {
  await cp(resolve(source, 'data', name), resolve(destination, 'data', name), { force: true })
}
await cp(resolve(source, 'data/tarajm-author-map.json'), resolve(destination, 'data/tarajm-author-map.json'), { force: true })
await cp(resolve(source, 'data/author-biography-coverage.manifest.json'), resolve(destination, 'data/author-biography-coverage.manifest.json'), { force: true })
await cp(resolve(source, 'data/author-biography-review.manifest.json'), resolve(destination, 'data/author-biography-review.manifest.json'), { force: true })

// Pages uploads use base64 JSON payloads, so a near-25 MiB biography asset can
// exceed a stable request size on slower links. Keep the authoritative source
// untouched and publish the complete record map in bounded local parts.
const tarajmPayload = JSON.parse(await readFile(resolve(source, 'data/tarajm-biographies.json'), 'utf8'))
const tarajmEntries = Object.entries(tarajmPayload.biographies ?? {})
const tarajmPartLimit = 3 * 1024 * 1024
const tarajmParts = []
let tarajmPart = {}
let tarajmPartBytes = 0
for (const [externalId, biography] of tarajmEntries) {
  const entryBytes = Buffer.byteLength(JSON.stringify({ [externalId]: biography }))
  if (tarajmPartBytes > 0 && tarajmPartBytes + entryBytes > tarajmPartLimit) {
    tarajmParts.push(tarajmPart)
    tarajmPart = {}
    tarajmPartBytes = 0
  }
  tarajmPart[externalId] = biography
  tarajmPartBytes += entryBytes
}
if (tarajmPartBytes > 0) tarajmParts.push(tarajmPart)
const tarajmPartNames = []
for (let index = 0; index < tarajmParts.length; index++) {
  const name = `tarajm-biographies-${String(index + 1).padStart(4, '0')}.json`
  await writeFile(resolve(destination, 'data', name), JSON.stringify({ schemaVersion: 1, biographies: tarajmParts[index] }))
  tarajmPartNames.push(name)
}
await writeFile(resolve(destination, 'data/tarajm-biographies.manifest.json'), JSON.stringify({
  schemaVersion: 1,
  recordCount: tarajmEntries.length,
  parts: tarajmPartNames,
}))
await rm(resolve(destination, 'data/tarajm-biographies.json'), { force: true })
// فهرس البوابات الخفيف عقد مختلف عن shamela-authors القديم؛ يُدرج باسمه الصريح
// من دون السماح بشجرة corpus الكاملة داخل مرشح الواجهة.
await cp(resolve(source, 'library/shamela/authors.json'), resolve(destination, 'data/shamela-author-index.json'), { force: true })

await mkdir(resolve(destination, 'library'), { recursive: true })
for (const name of ['published', 'shamela-sample']) {
  await cp(resolve(source, 'library', name), resolve(destination, 'library', name), { recursive: true, force: true })
}
// فهارس الهوية/المواضع فقط مطلوبة لفتح أي publicId وتصفية المؤلف/الفن.
// تبقى كتب corpus خارج المرشح وتُجلب عبر Pages بعد تحقق manifest والبصمة.
await cp(resolve(source, 'library/shamela/catalog.json'), resolve(destination, 'library/shamela/catalog.json'), { force: true })
for (const entry of await readdir(resolve(source, 'library/shamela/batches'), { withFileTypes: true })) {
  if (!entry.isDirectory() || !/^batch-\d{4}$/u.test(entry.name)) continue
  const target = resolve(destination, 'library/shamela/batches', entry.name)
  await mkdir(target, { recursive: true })
  await cp(resolve(source, 'library/shamela/batches', entry.name, 'manifest.json'), resolve(target, 'manifest.json'), { force: true })
}

const manifest = JSON.parse(await readFile(resolve(destination, 'library/published/manifest.json'), 'utf8'))
const sayyidQutbDiwan = manifest.works?.find(work => work.id === 'test-4a3e61ab3b660a72')
if (!sayyidQutbDiwan
  || sayyidQutbDiwan.sources?.find(source => source.format === 'word')?.sha256 !== 'f21266f0bba8d2d9b3f6fb0ed4a487c3caa98379a0b3461d7efb2cf47deb7902'
  || sayyidQutbDiwan.wordArtifact?.totalPages !== 299) {
  throw new Error('published_sayyid_qutb_diwan_missing_or_stale')
}
const maxPartBytes=25*1024*1024-1024
for(const work of manifest.works??[])for(const asset of work.sources??[]){
  if(asset.bytes<=maxPartBytes)continue
  const original=resolve(destination,asset.path.replace(/^\.\//,'')),handle=await open(original,'r'),parts=[]
  try{let offset=0,index=0;while(offset<asset.bytes){const length=Math.min(maxPartBytes,asset.bytes-offset),bytes=Buffer.allocUnsafe(length);await handle.read(bytes,0,length,offset);const path=`${asset.path}.part-${String(index).padStart(4,'0')}.bin`;await writeFile(resolve(destination,path.replace(/^\.\//,'')),bytes);parts.push({path,bytes:length,sha256:createHash('sha256').update(bytes).digest('hex')});offset+=length;index++}}finally{await handle.close()}
  const joined=Buffer.concat(await Promise.all(parts.map(part=>readFile(resolve(destination,part.path.replace(/^\.\//,''))))))
  if(joined.length!==asset.bytes||createHash('sha256').update(joined).digest('hex')!==asset.sha256)throw new Error(`published_asset_reassembly_drift:${asset.path}`)
  asset.parts=parts;await rm(original)
}
await writeFile(resolve(destination,'library/published/manifest.json'),`${JSON.stringify(manifest,null,2)}\n`)
let wordSources = 0
let wordMaps = 0
let wordFallbacks = 0
for (const work of manifest.works ?? []) {
  wordSources += (work.sources ?? []).filter(source => source.format === 'word').length
  if (work.wordArtifact) wordMaps++
  if (work.wordFallback) wordFallbacks++
}
if (wordSources !== 19 || wordMaps !== 16 || wordFallbacks !== 3 || wordSources !== wordMaps + wordFallbacks) {
  throw new Error(`published_word_allowlist_drift:${wordSources}:${wordMaps}:${wordFallbacks}`)
}

const top = new Set(await readdir(destination))
for (const forbidden of ['books']) if (top.has(forbidden)) throw new Error(`forbidden_ui_root:${forbidden}`)
const library = new Set(await readdir(resolve(destination, 'library')))
for (const forbidden of ['shamela-search', 'shamela-search-v2', 'shamela-search-v2-experimental']) {
  if (library.has(forbidden)) throw new Error(`forbidden_ui_library:${forbidden}`)
}
const shamelaEntries = new Set(await readdir(resolve(destination, 'library/shamela')))
if ([...shamelaEntries].some(name => name !== 'catalog.json' && name !== 'batches')) throw new Error('forbidden_ui_shamela_payload')
for (const batch of await readdir(resolve(destination, 'library/shamela/batches'))) {
  const entries = await readdir(resolve(destination, 'library/shamela/batches', batch))
  if (!/^batch-\d{4}$/u.test(batch) || entries.length !== 1 || entries[0] !== 'manifest.json') throw new Error(`forbidden_ui_shamela_batch:${batch}`)
}

console.log(`UI public allowlist staged; Word ${wordSources}=${wordMaps}+${wordFallbacks}`)

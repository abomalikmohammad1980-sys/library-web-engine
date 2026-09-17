import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const root = new URL('../app/public/', import.meta.url)
const packs = new URL('quran/resources/packs/mokhtasar-tafsir/', root)
const blocks = ['# المختصر في تفسير القرآن الكريم', '', '**المؤلف:** مركز تفسير للدراسات القرآنية', '', '**المصدر:** الحزمة المحلية الموثقة المرتبطة بآيات المصحف', '', '---', '']
for (let surah = 1; surah <= 114; surah++) {
  const payload = JSON.parse(readFileSync(new URL(`${surah}.json`, packs), 'utf8'))
  blocks.push(`## سورة ${surah}`, '')
  for (const record of payload.records) blocks.push(`### الآية ${record.ayah}`, '', String(record.text).trim(), '')
}
const data = Buffer.from(`${blocks.join('\n').trim()}\n`, 'utf8')
const packed = gzipSync(data, { level: 9 })
const sha256 = createHash('sha256').update(packed).digest('hex')
const relativePath = `./library/published/assets/${sha256.slice(0, 16)}.md.gz`
writeFileSync(new URL(relativePath.slice(2), root), packed)

const manifestPath = new URL('library/published/manifest.json', root)
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const work = {
  id: 'tafsir-mokhtasar-tafsir', title: 'المختصر في تفسير القرآن الكريم', author: 'مركز تفسير للدراسات القرآنية', status: 'ready',
  security: { verdict: 'allow', reasons: [] },
  sources: [{ format: 'markdown', role: 'primary', compression: 'gzip', path: relativePath, fileName: 'المختصر في تفسير القرآن الكريم - مركز تفسير.md', bytes: packed.byteLength, contentBytes: data.byteLength, sha256 }],
  metadata: { category: 'التفاسير', description: 'تفسير ميسر مرتبط بآيات المصحف، ويُقرأ ويُبحث فيه كأي كتاب آخر في الخِزانة.', sourceCitation: 'الموسوعة القرآنية — الكتاب 2003؛ نسخة محلية موثقة البصمة' },
  coverStrategy: 'generated',
}
const index = manifest.works.findIndex(item => item.id === work.id)
if (index >= 0) manifest.works[index] = work; else manifest.works.push(work)
for (const [id, number] of Object.entries({ 'tafsir-tabari': 4, 'tafsir-baghawi': 2, 'tafsir-saadi': 3 })) {
  const item = manifest.works.find(candidate => candidate.id === id)
  if (item) item.metadata.sourceCitation = `الموسوعة القرآنية — الكتاب ${number}؛ نسخة محلية موثقة البصمة`
}
manifest.workCount = manifest.works.length
manifest.readyCount = manifest.works.filter(item => item.status === 'ready').length
manifest.sourceFileCount = manifest.works.reduce((sum, item) => sum + item.sources.length, 0)
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ relativePath, bytes: data.byteLength, sha256 }))

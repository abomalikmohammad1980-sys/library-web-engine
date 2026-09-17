import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const appRoot = resolve(import.meta.dirname, '..')
const tafsirRoot = resolve(appRoot, 'public/quran/tafsir')
const publishedRoot = resolve(appRoot, 'public/library/published')
const assetsRoot = resolve(publishedRoot, 'assets')
const manifestPath = resolve(publishedRoot, 'manifest.json')
const books = [
  { slug: 'saadi', title: 'تفسير السعدي', author: 'عبد الرحمن بن ناصر السعدي' },
  { slug: 'baghawi', title: 'معالم التنزيل', author: 'الحسين بن مسعود البغوي' },
  { slug: 'tabari', title: 'جامع البيان', author: 'محمد بن جرير الطبري' },
]

const entities = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }
function plainText(html) {
  return html
    .replace(/<\s*(?:br|hr)\s*\/?\s*>/gi, '\n\n')
    .replace(/<\/(?:p|div)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, value => entities[value] ?? value)
    .replace(/&#(\d+);/g, (_value, code) => String.fromCodePoint(Number(code)))
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

await mkdir(assetsRoot, { recursive: true })
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const previousTafsirAssets = manifest.works.filter(work => String(work.id).startsWith('tafsir-')).flatMap(work => work.sources ?? [])
manifest.works = manifest.works.filter(work => !String(work.id).startsWith('tafsir-'))
for (const source of previousTafsirAssets) {
  const name = String(source.path ?? '').split('/').pop()
  if (name) await rm(resolve(assetsRoot, name), { force: true })
}
for (const book of books) {
  const files = (await readdir(resolve(tafsirRoot, book.slug))).filter(name => /^\d+\.json$/.test(name)).sort((a, b) => Number.parseInt(a) - Number.parseInt(b))
  const sections = []
  for (const file of files) {
    const payload = JSON.parse(await readFile(resolve(tafsirRoot, book.slug, file), 'utf8'))
    const segments = (payload.segments ?? []).map(segment => `### الآيات ${segment.from}${segment.to !== segment.from ? `–${segment.to}` : ''}\n\n${plainText(segment.text ?? '')}`).join('\n\n')
    sections.push(`## سورة ${payload.surah}\n\n${segments}`)
  }
  const markdown = `# ${book.title}\n\n**المؤلف:** ${book.author}\n\n**المصدر:** نص تفسير محلي منشور ضمن الخِزانة\n\n---\n\n${sections.join('\n\n---\n\n')}\n`
  const data = Buffer.from(markdown, 'utf8')
  const packed = gzipSync(data, { level: 9 })
  const sha256 = createHash('sha256').update(packed).digest('hex')
  const fileName = `${sha256.slice(0, 16)}.md.gz`
  await writeFile(resolve(assetsRoot, fileName), packed)
  manifest.works.push({
    id: `tafsir-${book.slug}`, title: book.title, author: book.author, status: 'ready',
    security: { verdict: 'allow', reasons: [] },
    sources: [{ format: 'markdown', role: 'primary', compression: 'gzip', path: `./library/published/assets/${fileName}`, fileName: `${book.title} - ${book.author}.md`, bytes: packed.byteLength, contentBytes: data.byteLength, sha256 }],
    metadata: { category: 'التفاسير', description: 'كتاب تفسير محلي مرتبط بآيات المصحف، ويُقرأ ويُبحث فيه كأي كتاب آخر في الخِزانة.' },
    coverStrategy: 'generated',
  })
}
manifest.sourceFileCount = manifest.works.reduce((total, work) => total + work.sources.length, 0)
manifest.workCount = manifest.works.length
manifest.readyCount = manifest.works.filter(work => work.status === 'ready' && work.security?.verdict === 'allow').length
manifest.datasetVersion = `${String(manifest.datasetVersion).replace(/-tafsir3$/, '')}-tafsir3`
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`Published tafsir books ready: ${books.length}; works=${manifest.workCount}; sources=${manifest.sourceFileCount}`)

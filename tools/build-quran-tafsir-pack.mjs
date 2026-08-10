import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const workspace = resolve(import.meta.dirname, '..')
const sourceRoot = resolve(workspace, '..', '..', 'generated', 'tafsir-source')
const outputRoot = resolve(workspace, 'app', 'public', 'quran', 'tafsir')
const books = [
  { id: 2, slug: 'baghawi', name: 'تفسير البغوي' },
  { id: 3, slug: 'saadi', name: 'تفسير السعدي' },
  { id: 4, slug: 'tabari', name: 'تفسير الطبري' },
]

await mkdir(outputRoot, { recursive: true })
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const manifest = {
  schemaVersion: 2,
  datasetId: 'quranpedia-exact-tafsir-segments',
  source: 'https://api.quranpedia.net/books-contents/',
  attribution: 'الموسوعة القرآنية Quranpedia — API v1؛ محتويات كتب التفسير المرتبطة بنطاقات آيات.',
  permissionBasis: 'USER-ATTESTED-WAQF-REUSE',
  books: [],
}
for (const book of books) {
  const sourceBytes = await readFile(join(sourceRoot, `book-${book.id}.json`))
  const payload = JSON.parse(sourceBytes.toString('utf8'))
  const bySurah = new Map()
  for (const item of payload.contents ?? []) {
    const match = /(?:^|,)(\d+):(\d+)-(\d+)(?:,|$)/.exec(String(item.related_ayahs ?? ''))
    if (!match) continue
    const surah = Number(match[1]), from = Number(match[2]), to = Number(match[3])
    if (!(surah >= 1 && surah <= 114 && from >= 1 && to >= from)) continue
    const segments = bySurah.get(surah) ?? []
    segments.push({ from, to, text: String(item.text ?? '') })
    bySurah.set(surah, segments)
  }
  const directory = join(outputRoot, book.slug); await mkdir(directory, { recursive: true })
  let segmentCount = 0
  const files = []
  for (const [surah, segments] of bySurah) {
    segmentCount += segments.length
    const file = `${book.slug}/${surah}.json`
    const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, bookId: book.id, name: book.name, surah, segments }))
    await writeFile(join(outputRoot, file), bytes)
    files.push({ surah, file, byteSize: bytes.length, checksumSha256: sha256(bytes), segments: segments.length })
  }
  files.sort((a, b) => a.surah - b.surah)
  manifest.books.push({ ...book, sourceChecksumSha256: sha256(sourceBytes), surahs: bySurah.size, segments: segmentCount, files })
}
await writeFile(join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(manifest, null, 2))

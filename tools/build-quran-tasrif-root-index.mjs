import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const workspace = resolve(import.meta.dirname, '..')
const sourceRoot = resolve(workspace, 'app/public/quran/resources/packs/surahpedia-tasrif-word')
const outputRoot = resolve(workspace, 'app/public/quran/resources/search')
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const marks = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu

export const normalizeArabicRoot = value => value.normalize('NFC').replace(marks, '').replace(/ـ/gu, '')
  .replace(/[أإآٱ]/gu, 'ا').replace(/ى/gu, 'ي').replace(/[^ء-ي]/gu, '').trim()

export const extractTasrifRoot = text => {
  const plain = text.normalize('NFC').replace(marks, '').replace(/ـ/gu, '')
  const match = /من\s+ماد(?:ة|ه):\s*\(([^)]+)\)/u.exec(plain)
  if (!match) return undefined
  const display = match[1].trim(), normalized = normalizeArabicRoot(display)
  return normalized ? { display, normalized } : undefined
}

const manifestBytes = await readFile(join(sourceRoot, 'manifest.json'))
const manifest = JSON.parse(manifestBytes)
if (manifest.schemaVersion !== 2 || manifest.resource?.kind !== 'tasrif' || manifest.coverage !== 'complete'
  || manifest.counts?.surahs !== 114 || manifest.counts?.ayahs !== 6236 || !Array.isArray(manifest.files) || manifest.files.length !== 114)
  throw Error('tasrif_manifest_incomplete')

const roots = new Map()
let verifiedAyahs = 0, verifiedWords = 0, indexedWords = 0
for (const file of manifest.files) {
  const bytes = await readFile(join(sourceRoot, file.file))
  if (bytes.length !== file.byteSize || sha256(bytes) !== file.checksumSha256) throw Error(`tasrif_file_integrity:${file.file}`)
  const payload = JSON.parse(bytes)
  if (payload.kind !== 'tasrif' || payload.surah !== file.surah || !Array.isArray(payload.records)) throw Error(`tasrif_file_identity:${file.file}`)
  verifiedAyahs += payload.records.length
  for (const record of payload.records) {
    if (!Number.isSafeInteger(record.ayah) || record.ayah < 1 || !Array.isArray(record.words)) throw Error(`tasrif_record_invalid:${file.file}`)
    verifiedWords += record.words.length
    for (const word of record.words) {
      const root = extractTasrifRoot(String(word.text ?? ''))
      if (!root) continue
      indexedWords += 1
      let bucket = roots.get(root.normalized)
      if (!bucket) { bucket = { root: root.display, normalized: root.normalized, occurrences: [] }; roots.set(root.normalized, bucket) }
      bucket.occurrences.push({ surah: payload.surah, ayah: record.ayah, position: word.position, word: word.word })
    }
  }
}
if (verifiedAyahs !== manifest.counts.ayahs || verifiedWords !== manifest.counts.words) throw Error('tasrif_recomputed_counts_mismatch')

const index = {
  schemaVersion: 1,
  datasetId: 'surahpedia-tasrif-root-index-v1',
  dataVersion: manifest.dataVersion,
  source: { manifestPath: '../packs/surahpedia-tasrif-word/manifest.json', manifestChecksumSha256: sha256(manifestBytes) },
  counts: { roots: roots.size, indexedWords, sourceWords: verifiedWords, ayahs: verifiedAyahs },
  roots: [...roots.values()].sort((a, b) => a.normalized.localeCompare(b.normalized, 'ar')),
}
await mkdir(outputRoot, { recursive: true })
const output = Buffer.from(`${JSON.stringify(index)}\n`), target = join(outputRoot, 'tasrif-root-index.json'), pending = `${target}.pending`
await writeFile(pending, output); await rename(pending, target)
process.stdout.write(`${JSON.stringify({ ...index.counts, bytes: output.length, sha256: sha256(output) })}\n`)

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const evidencePath = resolve(repo, process.argv[2] ?? 'tmp/publish-staging-2026-08-09/word-artifacts-manifest.json')
const roots = (process.argv.slice(3).length ? process.argv.slice(3) : [
  'app/public', 'app/dist', 'alpha-publish/pages-dist',
]).map(root => resolve(repo, root))
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'))
const failures = []
const hash = data => createHash('sha256').update(data).digest('hex')
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const sameJson = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
let checkedWorks = 0, checkedPages = 0

for (const root of roots) {
  const manifestPath = join(root, 'library/published/manifest.json')
  if (!existsSync(manifestPath)) { failures.push(`missing manifest: ${manifestPath}`); continue }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const words = manifest.works.filter(work => work.sources?.some(source => source.format === 'word'))
  if (words.length !== evidence.documents.length) failures.push(`${root}: expected ${evidence.documents.length} Word works, got ${words.length}`)
  for (const work of words) {
    const source = work.sources.find(item => item.format === 'word')
    const expected = evidence.documents.find(item => item.name === source.fileName)
    if (!expected) { failures.push(`${root}: no evidence for ${source.fileName}`); continue }
    const sourcePath = join(root, source.path.replace(/^\.\//, ''))
    const mapPath = join(root, work.wordArtifact?.path?.replace(/^\.\//, '') ?? '__missing__')
    if (!existsSync(sourcePath)) failures.push(`${root}: missing DOCX ${source.path}`)
    else if (hash(readFileSync(sourcePath)) !== source.sha256) failures.push(`${root}: DOCX fingerprint mismatch ${source.fileName}`)
    if (!existsSync(mapPath)) { failures.push(`${root}: missing map ${work.wordArtifact?.path}`); continue }
    const map = JSON.parse(readFileSync(mapPath, 'utf8'))
    const expectedMap = JSON.parse(readFileSync(expected.wordPageMap, 'utf8'))
    if (!sameJson(map, expectedMap)) failures.push(`${root}: map content mismatch ${source.fileName}`)
    if (map.totalPages !== work.wordArtifact.totalPages || map.paragraphCount !== work.wordArtifact.paragraphCount)
      failures.push(`${root}: manifest/map totals mismatch ${source.fileName}`)
    if (map.pages.length !== map.totalPages) failures.push(`${root}: map rows mismatch ${source.fileName}`)
    for (let index = 0; index < map.pages.length; index++) {
      const page = map.pages[index]
      if (page.physicalPage !== index + 1) { failures.push(`${root}: physical sequence at ${source.fileName} page ${index + 1}`); break }
      if (!Number.isInteger(page.adjustedPage)) { failures.push(`${root}: missing Word label at ${source.fileName} page ${index + 1}`); break }
    }
    checkedWorks++; checkedPages += map.totalPages
  }
}

if (failures.length) {
  console.error(JSON.stringify({ status: 'fail', failures }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ status: 'pass', roots: roots.length, works: checkedWorks,
  uniqueWorks: evidence.documents.length, pagesPerRoot: checkedPages / roots.length,
  verifiedMapRows: checkedPages }, null, 2))

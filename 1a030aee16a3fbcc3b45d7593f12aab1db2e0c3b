import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, normalize, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const roots = (process.argv.slice(2).length ? process.argv.slice(2) : [
  'app/public', 'app/dist', 'alpha-publish/pages-dist',
]).map(root => resolve(repo, root))
const failures = []
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const sameJson = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
const supported = new Set(['word', 'pdf', 'epub', 'shamela-bok'])
const seenIds = new Set(), seenPaths = new Map()
let baseline, checkedSources = 0, checkedWorks = 0, checkedBytes = 0

const resolvePublishedPath = (root, advertisedPath) => {
  if (typeof advertisedPath !== 'string' || isAbsolute(advertisedPath) || advertisedPath.includes('\\')) return null
  const clean = normalize(advertisedPath.replace(/^\.\//, ''))
  const resolved = resolve(root, clean)
  return relative(root, resolved).startsWith('..') ? null : resolved
}

for (const root of roots) {
  const manifestPath = join(root, 'library/published/manifest.json')
  if (!existsSync(manifestPath)) { failures.push(`missing manifest: ${manifestPath}`); continue }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (!baseline) baseline = manifest
  else if (!sameJson(manifest, baseline)) failures.push(`${root}: manifest differs from public baseline`)
  if (manifest.workCount !== 23 || manifest.readyCount !== 23 || manifest.works?.length !== 23)
    failures.push(`${root}: expected 23 published and ready works`)

  for (const work of manifest.works ?? []) {
    if (root === roots[0]) {
      if (seenIds.has(work.id)) failures.push(`${root}: duplicate work id ${work.id}`)
      seenIds.add(work.id)
    }
    if (work.status !== 'ready' || work.security?.verdict !== 'allow') failures.push(`${root}: blocked/non-ready work ${work.id}`)
    if (!work.title?.trim() || !work.author?.trim() || !work.sources?.length) failures.push(`${root}: incomplete work ${work.id}`)
    for (const source of work.sources ?? []) {
      if (!supported.has(source.format)) failures.push(`${root}: unsupported format ${source.format} in ${work.id}`)
      const sourcePath = resolvePublishedPath(root, source.path)
      if (!sourcePath) { failures.push(`${root}: unsafe source path ${source.path}`); continue }
      if (!existsSync(sourcePath)) { failures.push(`${root}: missing source ${source.path}`); continue }
      const bytes = readFileSync(sourcePath), extension = extname(source.fileName ?? '').toLowerCase()
      if (statSync(sourcePath).size !== source.bytes) failures.push(`${root}: size mismatch ${source.path}`)
      if (hash(bytes) !== source.sha256) failures.push(`${root}: sha256 mismatch ${source.path}`)
      if (source.format === 'pdf' && bytes.subarray(0, 5).toString('ascii') !== '%PDF-') failures.push(`${root}: invalid PDF ${source.path}`)
      if ((source.format === 'word' || source.format === 'epub') && bytes.subarray(0, 2).toString('ascii') !== 'PK') failures.push(`${root}: invalid ZIP package ${source.path}`)
      if (source.format === 'word' && extension !== '.docx') failures.push(`${root}: invalid Word extension ${source.fileName}`)
      if (source.format === 'epub' && extension !== '.epub') failures.push(`${root}: invalid EPUB extension ${source.fileName}`)
      if (source.format === 'shamela-bok' && extension !== '.bok') failures.push(`${root}: invalid BOK extension ${source.fileName}`)
      if (root === roots[0]) {
        const previous = seenPaths.get(source.path)
        if (previous && previous !== source.sha256) failures.push(`${root}: path reused with different bytes ${source.path}`)
        seenPaths.set(source.path, source.sha256)
      }
      checkedSources++; checkedBytes += bytes.length
    }
    checkedWorks++
  }
}

if (failures.length) {
  console.error(JSON.stringify({ status: 'fail', failures }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({
  status: 'pass', roots: roots.length, works: checkedWorks, uniqueWorks: seenIds.size,
  sources: checkedSources, uniqueSourcePaths: seenPaths.size, checkedBytes,
  formats: [...supported],
}, null, 2))

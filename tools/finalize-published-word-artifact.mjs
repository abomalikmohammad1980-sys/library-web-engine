import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const [artifactManifestPath, publishedDir] = process.argv.slice(2)
if (!artifactManifestPath || !publishedDir) throw new Error('usage: node finalize-published-word-artifact.mjs <artifact-manifest> <published>')
const artifactManifest = JSON.parse(readFileSync(artifactManifestPath, 'utf8'))
const manifestPath = join(publishedDir, 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const assets = join(publishedDir, 'assets'), maps = join(publishedDir, 'word-page-maps')
mkdirSync(assets, { recursive: true }); mkdirSync(maps, { recursive: true })
const hash = data => createHash('sha256').update(data).digest('hex')
let completed = 0
for (const artifact of artifactManifest.documents ?? []) {
  if (artifact.status !== 'complete' || !artifact.generatedPdf || !artifact.wordPageMap) continue
  const work = manifest.works.find(item => item.sources?.some(source => source.format === 'word' && source.fileName === artifact.name))
  if (!work) throw new Error(`manifest work not found: ${artifact.name}`)
  const word = work.sources.find(source => source.format === 'word')
  if (!word) throw new Error(`word source missing: ${artifact.name}`)
  const pdfData = readFileSync(artifact.generatedPdf), pdfSha = hash(pdfData), pdfName = `${pdfSha.slice(0, 16)}.pdf`
  const mapName = `${artifact.sha256.slice(0, 12)}.json`
  copyFileSync(artifact.generatedPdf, join(assets, pdfName))
  copyFileSync(artifact.wordPageMap, join(maps, mapName))
  work.sources = [word, { format: 'pdf', role: 'alternate', path: `./library/published/assets/${pdfName}`,
    fileName: `${basename(artifact.name, '.docx')}.pdf`, bytes: pdfData.byteLength, sha256: pdfSha }]
  work.wordArtifact = { path: `./library/published/word-page-maps/${mapName}`,
    totalPages: artifact.totalPages, paragraphCount: artifact.paragraphCount }
  work.status = 'ready'; work.security = { verdict: 'allow', reasons: [] }; work.coverStrategy = 'pdf-page-1'
  completed++
}
manifest.readyCount = manifest.works.filter(work => work.status === 'ready' && work.security?.verdict === 'allow').length
manifest.datasetVersion = '2026.08.09-complete-28'
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ completed, readyCount: manifest.readyCount, sourceFileCount: manifest.sourceFileCount, workCount: manifest.workCount }))

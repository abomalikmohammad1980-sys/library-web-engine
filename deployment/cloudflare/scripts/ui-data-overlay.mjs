import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const exactOrigin = value => {
  let url
  try { url = new URL(value) } catch { throw new Error('ui_overlay_url_invalid') }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('ui_overlay_url_invalid')
  return url.origin
}

export function validateUiDataOverlay(value) {
  if (value?.contract !== 'alkhizana-ui-data-overlay/1' || value?.deploymentStatus !== 'expected-not-verified') throw new Error('ui_overlay_header_invalid')
  if (!/^[a-f0-9]{64}$/.test(value.candidatePayloadFingerprint ?? '')) throw new Error('ui_overlay_candidate_invalid')
  const corpus = value.corpus
  if (corpus?.contract !== 'alkhizana-pages-client/1' || !/^[a-f0-9]{24}$/.test(corpus.releaseId ?? '') || !/^[a-f0-9]{64}$/.test(corpus.releaseManifestSha256 ?? '')) throw new Error('ui_overlay_corpus_invalid')
  if (!Array.isArray(corpus.projects) || corpus.projects.length !== 1) throw new Error('ui_overlay_corpus_projects_invalid')
  const corpusProject = corpus.projects[0]
  if (corpusProject.name !== 'khezana-corpus-01' || corpusProject.manifestProject !== 'corpus-01' || exactOrigin(corpusProject.baseUrl) !== 'https://khezana-corpus-01.pages.dev' || !Number.isSafeInteger(corpusProject.files) || !Number.isSafeInteger(corpusProject.bytes) || !Number.isSafeInteger(corpusProject.assetCount)) throw new Error('ui_overlay_corpus_project_invalid')
  const search = value.search
  if (search?.contract !== 'shamela-search-v2/pages-ready-1' || typeof search.releaseId !== 'string' || !/^[a-f0-9]{64}$/.test(search.readyManifestSha256 ?? '') || !/^[a-f0-9]{64}$/.test(search.sourceManifestSha256 ?? '')) throw new Error('ui_overlay_search_invalid')
  if (!Array.isArray(search.projects) || search.projects.length !== 8 || !Array.isArray(search.runtimeConfig?.projectBaseUrls) || search.runtimeConfig.projectBaseUrls.length !== 8) throw new Error('ui_overlay_search_projects_invalid')
  const projects = search.projects.map((project, index) => {
    const suffix = String(index).padStart(2, '0')
    const expectedName = `khezana-search-v2-${suffix}`
    const expectedUrl = `https://${expectedName}.pages.dev`
    if (project.name !== expectedName || exactOrigin(project.baseUrl) !== expectedUrl || !/^[a-f0-9]{64}$/.test(project.deploymentManifestSha256 ?? '')) throw new Error('ui_overlay_search_project_invalid')
    if (exactOrigin(search.runtimeConfig.projectBaseUrls[index]) !== expectedUrl) throw new Error('ui_overlay_search_runtime_mismatch')
    if (![project.files, project.bytes, project.maxBytes].every(Number.isSafeInteger)) throw new Error('ui_overlay_search_counts_invalid')
    return { name: project.name, baseUrl: expectedUrl, deploymentManifestSha256: project.deploymentManifestSha256, files: project.files, bytes: project.bytes, maxBytes: project.maxBytes }
  })
  const control = new URL(search.runtimeConfig.controlBaseUrl)
  if (control.protocol !== 'https:' || control.origin !== projects[0].baseUrl || control.pathname !== '/control' || control.search || control.hash) throw new Error('ui_overlay_search_control_invalid')
  return {
    contract: value.contract,
    deploymentStatus: value.deploymentStatus,
    candidatePayloadFingerprint: value.candidatePayloadFingerprint,
    corpus: { ...corpus, projects: [{ ...corpusProject, baseUrl: exactOrigin(corpusProject.baseUrl) }] },
    search: { ...search, runtimeConfig: { controlBaseUrl: `${projects[0].baseUrl}/control`, projectBaseUrls: projects.map(p => p.baseUrl) }, projects },
  }
}

export function materializeRuntimeFiles(value, indexHtml) {
  const overlay = validateUiDataOverlay(value)
  const corpus = `${JSON.stringify({ contract: overlay.corpus.contract, releaseId: overlay.corpus.releaseId, projects: overlay.corpus.projects.map(({ manifestProject, baseUrl }) => ({ name: manifestProject, group: 'corpus', baseUrl })) }, null, 2)}\n`
  const packed = `globalThis.__SHAMELA_SEARCH_V2_PACKED__=Object.freeze(${JSON.stringify(overlay.search.runtimeConfig)});\n`
  const needle = '    <script type="module"'
  if (!indexHtml.includes(needle) || indexHtml.includes('data/shamela-search-v2-packed.js')) throw new Error('ui_overlay_index_anchor_invalid')
  const index = indexHtml.replace(needle, '    <script src="./data/shamela-search-v2-packed.js"></script>\n' + needle)
  return new Map([['data/shamela-pages-release.json', Buffer.from(corpus)], ['data/shamela-search-v2-packed.js', Buffer.from(packed)], ['index.html', Buffer.from(index)]])
}

async function inventoryWithTransform(directory, replacements) {
  const files = []
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = resolve(current, entry.name)
      const stat = await lstat(absolute)
      const path = relative(directory, absolute).split(sep).join('/')
      if (path === 'q13-manifest.json') continue
      if (stat.isDirectory()) await walk(absolute)
      else if (stat.isFile() && !replacements.has(path)) {
        const bytes = await readFile(absolute)
        files.push({ path, size: bytes.byteLength, sha256: sha(bytes) })
      }
    }
  }
  await walk(directory)
  for (const [path, bytes] of replacements) files.push({ path, size: bytes.byteLength, sha256: sha(bytes) })
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'))
  return { fileCount: files.length, totalBytes: files.reduce((n, f) => n + f.size, 0), fingerprint: sha(JSON.stringify(files)), files }
}

export async function previewCandidateTransform(root, value) {
  const pages = resolve(root, 'pages-dist')
  const index = await readFile(resolve(pages, 'index.html'), 'utf8')
  const replacements = materializeRuntimeFiles(value, index)
  const inventory = await inventoryWithTransform(pages, replacements)
  return { contract: 'alkhizana-ui-candidate-transform/1', applied: false, sourcePayloadFingerprint: value.candidatePayloadFingerprint, transformedPayloadFingerprint: inventory.fingerprint, fileCount: inventory.fileCount, totalBytes: inventory.totalBytes, changedFiles: [...replacements].map(([path, bytes]) => ({ path, size: bytes.byteLength, sha256: sha(bytes) })), files: inventory.files }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const input = resolve(process.argv[2] ?? '')
  const output = resolve(process.argv[3] ?? '')
  if (!process.argv[2] || !process.argv[3]) throw new Error('usage: ui-data-overlay.mjs overlay.json transform-preview.json')
  const overlay = validateUiDataOverlay(JSON.parse(await readFile(input, 'utf8')))
  const preview = await previewCandidateTransform(root, overlay)
  await writeFile(output, `${JSON.stringify(preview, null, 2)}\n`, { flag: 'wx' })
  console.log(`Overlay validated; unapplied transform ${preview.transformedPayloadFingerprint}`)
}

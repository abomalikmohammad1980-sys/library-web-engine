import { createHash } from 'node:crypto'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { reviewedPublicMapKeySpans } from './reviewed-public-map-key.mjs'
import {assertSearchBootstrap} from './search-bootstrap.mjs'
import {assertServiceWorkerRelease} from './service-worker-release.mjs'

const MAX_FILES = 20_000
const MAX_FILE_BYTES = 25 * 1024 * 1024

export async function inventory(directory, { exclude = new Set() } = {}) {
  const root = resolve(directory)
  let publicMapHtml=''
  try {const index=resolve(root,'index.html'),info=await lstat(index);if(info.isSymbolicLink()||!info.isFile())throw new Error('unsafe_artifact_entry:index.html');if(info.size<=65536)publicMapHtml=await readFile(index,'utf8')} catch(error){if(error.code!=='ENOENT')throw error}
  const files = []
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = resolve(current, entry.name)
      if (absolute !== root && !absolute.startsWith(root + sep)) throw new Error('artifact_path_escape')
      const stat = await lstat(absolute)
      const path = relative(root, absolute).split(sep).join('/')
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) throw new Error(`unsafe_artifact_entry:${path}`)
      if (stat.isDirectory()) await walk(absolute)
      else if (!exclude.has(path)) {
        const bytes = await readFile(absolute)
        scan(path, bytes, publicMapHtml)
        files.push({ path, size: bytes.byteLength, sha256: sha(bytes) })
      }
    }
  }
  await walk(root)
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'))
  return {
    files,
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    maxFileBytes: Math.max(0, ...files.map(file => file.size)),
    fingerprint: sha(JSON.stringify(files)),
  }
}

export async function verifyRelease({ pagesDirectory, releasesDirectory, publicationSourceDirectory = resolve(fileURLToPath(new URL('../../app/public/', import.meta.url))) }) {
  const pages = resolve(pagesDirectory)
  const releases = resolve(releasesDirectory)
  // Fail before the expensive complete-tree inventory; retained rollback trees
  // are byte-verified below, not required to adopt new candidate contracts.
  await verifyPagesConfiguration(pages)
  const embedded = JSON.parse(await readFile(resolve(pages, 'q13-manifest.json'), 'utf8'))
  const payload = await inventory(pages, { exclude: new Set(['q13-manifest.json']) })
  assertManifest(embedded, payload, 'candidate')
  const deployed = await inventory(pages)
  if (deployed.fileCount > MAX_FILES) throw new Error(`cloudflare_file_count_exceeded:${deployed.fileCount}`)
  if (deployed.maxFileBytes > MAX_FILE_BYTES) throw new Error(`cloudflare_asset_too_large:${deployed.maxFileBytes}`)

  const current = JSON.parse(await readFile(resolve(releases, 'current.json'), 'utf8'))
  if (current.payloadFingerprint !== payload.fingerprint || current.deployFingerprint !== deployed.fingerprint) throw new Error('current_pointer_drift')
  if (resolve(releases, requireRelativePath(current.artifact, 'current_artifact')) !== pages) throw new Error('current_artifact_pointer_drift')
  if (resolve(releases, requireRelativePath(current.manifest, 'current_manifest')) !== resolve(pages, 'q13-manifest.json')) throw new Error('current_manifest_pointer_drift')
  const previousPointer = resolveWithin(releases, current.previousPointer, 'previous_pointer')
  const previous = JSON.parse(await readFile(previousPointer, 'utf8'))
  const previousDirectory = resolveWithin(releases, previous.artifact, 'previous_artifact')
  const previousManifestPath = resolveWithin(releases, previous.manifest, 'previous_manifest')
  const previousManifest = JSON.parse(await readFile(previousManifestPath, 'utf8'))
  const previousInventory = await inventory(previousDirectory)
  assertManifest(previousManifest, previousInventory, 'previous')
  if (previous.fingerprint !== previousInventory.fingerprint) throw new Error('previous_pointer_drift')

  const publication = await verifyPublication(pages, resolve(publicationSourceDirectory))
  return { payload, deployed, previous: previousInventory, publication }
}

function requireRelativePath(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0') || /^[A-Za-z]:[\\/]|^[\\/]/.test(value)) throw new Error(`${label}_invalid`)
  return value
}

function resolveWithin(root, value, label) {
  const base = resolve(root)
  const target = resolve(base, requireRelativePath(value, label))
  if (target !== base && !target.startsWith(base + sep)) throw new Error(`${label}_escape`)
  return target
}

function assertManifest(expected, actual, label) {
  if (expected.fingerprint !== actual.fingerprint || expected.fileCount !== actual.fileCount || expected.totalBytes !== actual.totalBytes || expected.maxFileBytes !== actual.maxFileBytes) throw new Error(`${label}_manifest_drift`)
  if (expected.files.length !== actual.files.length || expected.files.some((file, index) => JSON.stringify(file) !== JSON.stringify(actual.files[index]))) throw new Error(`${label}_file_drift`)
}

export async function verifyPagesConfiguration(pages,{allowDeferredSearchBootstrap=false}={}) {
  const index=await readFile(resolve(pages,'index.html'),'utf8')
  assertSearchBootstrap(index,{allowDeferred:allowDeferredSearchBootstrap})
  const searchBootstrap=await readFile(resolve(pages,'data/shamela-search-v2-packed.js'),'utf8')
  if(!searchBootstrap.includes('__SHAMELA_SEARCH_V2_PACKED__')||!searchBootstrap.includes('/r2/khezana-search-v2-00/control'))throw Error('search_bootstrap_configuration_missing')
  const headers = await readFile(resolve(pages, '_headers'), 'utf8')
  const redirects = await readFile(resolve(pages, '_redirects'), 'utf8')
  const serviceWorker = await readFile(resolve(pages, 'sw.js'), 'utf8')
  assertServiceWorkerRelease(serviceWorker,index)
  for (const required of ['X-Content-Type-Options: nosniff', 'Permissions-Policy:', 'Cache-Control: public, max-age=31536000, immutable']) if (!headers.includes(required)) throw new Error(`pages_headers_missing:${required}`)
  if (redirects.split(/\r?\n/).some(line => /^\s*\/\*\s+\/index\.html\s+200\s*$/.test(line))) throw new Error('pages_soft_404_rewrite')
  const notFound = await readFile(resolve(pages, '404.html'), 'utf8')
  if (!notFound.includes('الصفحة غير موجودة') || !/href="\/(?:#\/)?"/.test(notFound)) throw new Error('pages_not_found_missing')
  if (!/alkhizana-shell-v\d+/.test(serviceWorker)) throw new Error('service_worker_version_missing')
  if (/const SHELL = \[[\s\S]*shamela-authors\.json/.test(serviceWorker)) throw new Error('large_catalog_in_required_shell')
  for (const page of ['001.svg', '604.svg']) {
    const svg = await readFile(resolve(pages, 'quran/mushaf/hafs', page), 'utf8')
    if (!/<svg(?:\s|>)/i.test(svg)) throw new Error(`quran_mushaf_page_invalid:${page}`)
  }
}

async function verifyPublication(pages, publicationSource) {
  const manifest = JSON.parse(await readFile(resolve(pages, 'library/published/manifest.json'), 'utf8'))
  const stagedEntries = await readdir(resolve(pages, 'library/published'), { withFileTypes: true })
  if (stagedEntries.some(entry => entry.name !== 'manifest.json')) throw new Error('publication_pages_contains_r2_assets')
  const sayyidQutbDiwan = manifest.works?.find(work => work.id === 'test-4a3e61ab3b660a72')
  if (!sayyidQutbDiwan
    || sayyidQutbDiwan.sources?.find(source => source.format === 'word')?.sha256 !== 'f21266f0bba8d2d9b3f6fb0ed4a487c3caa98379a0b3461d7efb2cf47deb7902'
    || sayyidQutbDiwan.wordArtifact?.totalPages !== 299) {
    throw new Error('publication_sayyid_qutb_diwan_missing_or_stale')
  }
  let wordSources = 0, wordMaps = 0, wordFallbacks = 0
  if (!Array.isArray(manifest.works) || manifest.works.length !== manifest.workCount || manifest.works.some(work => work.status !== 'ready')) throw new Error('publication_readiness_drift')
  for (const work of manifest.works) {
    for (const source of work.sources ?? []) {
      if (source.format === 'word') wordSources++
      const chunks = await Promise.all((source.parts?.length?source.parts:[source]).map(async part=>{const bytes=await readFile(resolve(publicationSource,part.path.replace(/^\.\//,'')));if(bytes.byteLength!==part.bytes||sha(bytes)!==part.sha256)throw new Error(`publication_source_part_drift:${work.id}`);return bytes}))
      const bytes=Buffer.concat(chunks)
      if (bytes.byteLength !== source.bytes || sha(bytes) !== source.sha256) throw new Error(`publication_source_drift:${work.id}`)
    }
    if (work.wordArtifact) { wordMaps++; await readFile(resolve(publicationSource, work.wordArtifact.path.replace(/^\.\//, ''))) }
    if (work.wordFallback) {
      if (!Number.isInteger(work.wordFallback.paragraphCount) || work.wordFallback.paragraphCount <= 0
        || !/^[a-f0-9]{64}$/.test(work.wordFallback.extractedTextSha256 ?? ''))
        throw new Error(`publication_word_fallback_invalid:${work.id}`)
      wordFallbacks++
    }
    if (work.wordArtifact && work.wordFallback) throw new Error(`publication_word_pagination_ambiguous:${work.id}`)
  }
  if (wordSources !== wordMaps + wordFallbacks) throw new Error(`publication_word_pagination_gap:${wordSources}:${wordMaps}:${wordFallbacks}`)
  return { works: manifest.works.length, ready: manifest.readyCount, wordSources, wordMaps, wordFallbacks }
}

function scan(path, bytes, publicMapHtml) {
  if (!/\.(?:html?|css|js|mjs|json|xml|txt|md|webmanifest|svg)$/i.test(path)) return
  let text = bytes.toString('utf8')
  // Only replace reviewed value spans in an ephemeral scan buffer. Artifact
  // bytes and fingerprints remain untouched; other secrets still fail below.
  if(/publicApiKey/.test(text))for(const span of reviewedPublicMapKeySpans(path,text,publicMapHtml).sort((a,b)=>b.start-a.start))text=text.slice(0,span.start)+'"PUBLIC_MAP_KEY"'+text.slice(span.end)
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|secret|token)["']?\s*[:=]\s*["'][A-Za-z0-9_-]{20,}["']|[A-Z]:\\Users\\/i.test(text)) throw new Error(`artifact_sensitive_content:${path}`)
}

function sha(value) { return createHash('sha256').update(value).digest('hex') }

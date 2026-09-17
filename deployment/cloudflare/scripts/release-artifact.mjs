import { createHash } from 'node:crypto'
import { cp, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.env.ALKHIZANA_RELEASE_ROOT
  ? resolve(process.env.ALKHIZANA_RELEASE_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pages = resolve(root, 'pages-dist')
const releases = resolve(root, 'release-artifacts')
const phase = process.argv[2]

async function inventory(directory, excluded = new Set()) {
  const files = []
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = resolve(current, entry.name)
      const stat = await lstat(absolute)
      const relativePath = relative(directory, absolute).split(sep).join('/')
      if (excluded.has(relativePath)) continue
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) throw new Error(`unsafe_artifact_entry:${relativePath}`)
      if (stat.isDirectory()) await walk(absolute)
      else {
        const bytes = await readFile(absolute)
        files.push({ path: relative(directory, absolute).split(sep).join('/'), size: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') })
      }
    }
  }
  await walk(directory)
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'))
  const payload = JSON.stringify(files)
  return {
    schemaVersion: 1,
    // Build time belongs to external release state, not the content-addressed
    // manifest. Include it only when CI supplies a reproducible epoch.
    ...(process.env.SOURCE_DATE_EPOCH
      ? { generatedAt: new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString() }
      : {}),
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    maxFileBytes: Math.max(0, ...files.map(file => file.size)),
    fingerprint: createHash('sha256').update(payload).digest('hex'),
    files,
  }
}

async function verifyCandidate() {
  const current = JSON.parse(await readFile(resolve(releases, 'current.json'), 'utf8'))
  const previous = JSON.parse(await readFile(resolve(releases, 'previous.json'), 'utf8'))
  const embedded = JSON.parse(await readFile(resolve(pages, 'q13-manifest.json'), 'utf8'))
  const payload = await inventory(pages, new Set(['q13-manifest.json']))
  const full = await inventory(pages)
  const previousManifest = JSON.parse(await readFile(resolve(releases, previous.manifest), 'utf8'))
  if (payload.fingerprint !== embedded.fingerprint || payload.fingerprint !== current.payloadFingerprint) throw new Error('q13_payload_drift')
  if (full.fingerprint !== current.deployFingerprint) throw new Error('q13_deploy_drift')
  if (previousManifest.fingerprint !== previous.fingerprint) throw new Error('q14_previous_drift')
  console.log(`Release verified: ${payload.fileCount} payload files, ${payload.fingerprint}`)
}

async function snapshotPrevious() {
  const manifest = await inventory(pages)
  const destination = resolve(releases, manifest.fingerprint)
  await mkdir(destination, { recursive: true })
  await cp(pages, resolve(destination, 'pages-dist'), { recursive: true, force: false, errorOnExist: false })
  await writeFile(resolve(destination, 'q13-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  await writeFile(resolve(releases, 'previous.json'), JSON.stringify({ fingerprint: manifest.fingerprint, artifact: `${manifest.fingerprint}/pages-dist`, manifest: `${manifest.fingerprint}/q13-manifest.json` }, null, 2) + '\n')
  console.log(`Previous immutable artifact retained: ${manifest.fingerprint}`)
}

async function writeCandidate() {
  // Re-running candidate on the same reviewed tree must not make the old
  // embedded manifest part of the next payload fingerprint.
  const manifest = await inventory(pages, new Set(['q13-manifest.json']))
  if (manifest.maxFileBytes >= 25 * 1024 * 1024) throw new Error(`cloudflare_asset_too_large:${manifest.maxFileBytes}`)
  await writeFile(resolve(pages, 'q13-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  const verified = await inventory(pages)
  // The embedded manifest changes the final tree, so current.json records both
  // the reviewed payload fingerprint and the deploy-directory fingerprint.
  await mkdir(releases, { recursive: true })
  await writeFile(resolve(releases, 'current.json'), JSON.stringify({ payloadFingerprint: manifest.fingerprint, deployFingerprint: verified.fingerprint, artifact: '../pages-dist', manifest: '../pages-dist/q13-manifest.json', previousPointer: 'previous.json' }, null, 2) + '\n')
  console.log(`Q13 candidate ready: ${manifest.fileCount} files, ${manifest.fingerprint}`)
}

if (phase === 'snapshot-previous') await snapshotPrevious()
else if (phase === 'candidate') await writeCandidate()
else if (phase === 'verify') await verifyCandidate()
else throw new Error('usage: release-artifact.mjs snapshot-previous|candidate|verify')

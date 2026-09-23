// Freeze the verified client over batch84 without copying or changing backend data.
import { createHash } from 'node:crypto'
import { readFile, readdir, mkdir, link, copyFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { injectSearchBootstrap } from './search-bootstrap-html.mjs'
import { inlineThemeBootstrap } from './inline-theme-bootstrap.mjs'
import { inlineRoutePreloads } from './route-preload-hints.mjs'
import { stampServiceWorkerRelease } from '../alpha-publish/scripts/service-worker-release.mjs'

const root = resolve(import.meta.dirname, '..')
const workspace = resolve(root, '../تعديلات على المكتبة')
const baseline = resolve(workspace, '.artifacts/review-20260923-sw-recovery-v25')
const client = resolve(workspace, process.env.KHIZANA_CLIENT_ARTIFACT ?? '.artifacts/review-20260923-client-v26')
const target = resolve(workspace, process.env.KHIZANA_TARGET_ARTIFACT ?? '.artifacts/review-20260923-embedded-heading-v27')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const manifest = JSON.parse(await readFile(resolve(baseline, 'inventory.json')))
if (manifest.length !== 20000) throw Error('baseline_inventory_changed')
const replacements = new Map()
async function collectAssets(dir) {
  for (const entry of await readdir(resolve(client, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) await collectAssets(path)
    else if (entry.isFile()) replacements.set(path, await readFile(resolve(client, path)))
    else throw Error('unexpected_asset_type')
  }
}
await collectAssets('assets')
for (const path of ['theme-init.js', 'manifest.webmanifest', 'quran/resources/manifest.json']) replacements.set(path, await readFile(resolve(client, path)))
const html = inlineThemeBootstrap(
  injectSearchBootstrap(await readFile(resolve(client, 'index.html'), 'utf8'), { defer: true }),
  await readFile(resolve(baseline, 'deploy/pages-dist/_headers'), 'utf8'),
  replacements.get('theme-init.js').toString(),
)
Object.assign(html, inlineRoutePreloads(html.index, html.headers, JSON.parse(await readFile(resolve(client, 'route-preload-hints.json')))))
replacements.set('index.html', Buffer.from(html.index))
replacements.set('_headers', Buffer.from(html.headers))
replacements.set('sw.js', Buffer.from(stampServiceWorkerRelease(await readFile(resolve(client, 'sw.js'), 'utf8'), html.index)))
const retained = manifest.filter(row => !row.path.startsWith('assets/') && !replacements.has(row.path))
if (retained.length + replacements.size !== 20000) throw Error(`pages_file_budget:${retained.length + replacements.size}`)
await mkdir(target)
const inventory = []
for (const row of retained) {
  const from = resolve(baseline, 'deploy/pages-dist', row.path)
  const to = resolve(target, 'deploy/pages-dist', row.path)
  await mkdir(dirname(to), { recursive: true })
  await link(from, to)
  inventory.push(row)
}
for (const [path, bytes] of replacements) {
  const to = resolve(target, 'deploy/pages-dist', path)
  await mkdir(dirname(to), { recursive: true })
  await writeFile(to, bytes, { flag: 'wx' })
  inventory.push({ path, bytes: bytes.length, sha256: sha(bytes) })
}
async function copyTree(part) {
  for (const entry of await readdir(resolve(baseline, part), { withFileTypes: true })) {
    const child = `${part}/${entry.name}`
    if (entry.isDirectory()) await copyTree(child)
    else if (entry.isFile()) {
      await mkdir(dirname(resolve(target, child)), { recursive: true })
      await copyFile(resolve(baseline, child), resolve(target, child))
    } else throw Error('unexpected_support_file')
  }
}
for (const part of ['deploy/functions', 'deploy/server', 'app', 'packages']) await copyTree(part)
if (process.env.KHIZANA_CATALOG_PROXY === '1') {
  const route = 'api/library/catalog-snapshot.js'
  await mkdir(dirname(resolve(target, 'deploy/functions', route)), { recursive: true })
  await copyFile(resolve(root, 'alpha-publish/functions', route), resolve(target, 'deploy/functions', route))
}
await copyFile(resolve(baseline, 'deploy/wrangler.jsonc'), resolve(target, 'deploy/wrangler.jsonc'))
inventory.sort((a, b) => a.path.localeCompare(b.path))
const fingerprint = sha(JSON.stringify(inventory))
await writeFile(resolve(target, 'inventory.json'), JSON.stringify(inventory), { flag: 'wx' })
await writeFile(resolve(target, 'preview.json'), JSON.stringify({ status: 'preview-only', productionReady: false, baseline: 'batch84', staticFiles: inventory.length, payloadFingerprint: fingerprint, backend: process.env.KHIZANA_CATALOG_PROXY === '1' ? 'batch84 plus pinned catalog proxy without database' : 'byte-identical to batch84', scope: process.env.KHIZANA_CATALOG_PROXY === '1' ? 'bundled heading descriptor and service-worker-bypassing catalog proxy' : 'bundled verified heading release descriptor' }, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ target, staticFiles: inventory.length, payloadFingerprint: fingerprint }))

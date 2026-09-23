// Freeze a one-file service-worker recovery over the already accepted batch83.
// All other static bytes and every backend function remain identical.
import { createHash } from 'node:crypto'
import { readFile, readdir, mkdir, link, copyFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { stampServiceWorkerRelease } from '../alpha-publish/scripts/service-worker-release.mjs'

const root = resolve(import.meta.dirname, '..')
const base = resolve(root, '../تعديلات على المكتبة/.artifacts/review-20260923-ui-only-v23')
const out = resolve(root, '../تعديلات على المكتبة/.artifacts/review-20260923-sw-recovery-v25')
const sha = value => createHash('sha256').update(value).digest('hex')
const current = JSON.parse(await readFile(resolve(root, '../تعديلات على المكتبة/alpha-publish/ops/current-production.json')))
if (current.version !== 'batch-20260923-83' || current.deploymentId !== 'c1e0a60d-8bc2-4f7f-9277-5b1390c5a373') throw Error('production_baseline_changed')
const source = resolve(base, 'deploy/pages-dist')
const target = resolve(out, 'deploy/pages-dist')
const sourceInventory = JSON.parse(await readFile(resolve(root, '../تعديلات على المكتبة/.artifacts/review-20260923-integrated-v22/inventory.json')))
if (sourceInventory.length !== 20000) throw Error('source_inventory_changed')
const html = await readFile(resolve(source, 'index.html'), 'utf8')
const worker = stampServiceWorkerRelease(await readFile(resolve(root, 'app/public/sw.js'), 'utf8'), html)
if (!worker.includes("const CACHE = 'alkhizana-shell-v19'") || !worker.includes("url.pathname === '/data/heading-release.json'")) throw Error('recovery_worker_missing')
await mkdir(out)
const inventory = []
for (const row of sourceInventory) {
  const from = resolve(source, row.path)
  const to = resolve(target, row.path)
  await mkdir(dirname(to), { recursive: true })
  if (row.path === 'sw.js') {
    await writeFile(to, worker, { flag: 'wx' })
    const bytes = Buffer.from(worker)
    inventory.push({ path: row.path, bytes: bytes.length, sha256: sha(bytes) })
  } else {
    await link(from, to)
    inventory.push(row)
  }
}
for (const file of ['wrangler.jsonc']) await copyFile(resolve(base, 'deploy', file), resolve(out, 'deploy', file))
async function copyTree(part) {
  for (const entry of await readdir(resolve(base, part), { withFileTypes: true })) {
    const child = `${part}/${entry.name}`
    if (entry.isDirectory()) await copyTree(child)
    else if (entry.isFile()) {
      await mkdir(dirname(resolve(out, child)), { recursive: true })
      await copyFile(resolve(base, child), resolve(out, child))
    } else throw Error('unexpected_backend_file')
  }
}
await copyTree('deploy/functions')
await copyTree('deploy/server')
await copyTree('app')
await copyTree('packages')
inventory.sort((a, b) => a.path.localeCompare(b.path))
const fingerprint = sha(JSON.stringify(inventory))
await writeFile(resolve(out, 'inventory.json'), JSON.stringify(inventory), { flag: 'wx' })
await writeFile(resolve(out, 'preview.json'), JSON.stringify({ status: 'preview-only', productionReady: false, baseline: current.version, staticFiles: inventory.length, payloadFingerprint: fingerprint, changedStaticPaths: ['sw.js'], backend: 'byte-identical to batch83', rollback: current.deploymentId }, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ out, staticFiles: inventory.length, payloadFingerprint: fingerprint }))

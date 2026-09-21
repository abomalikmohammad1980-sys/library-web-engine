import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const batch = process.argv[2] ?? '56'
assert(['56','57','58','59','60','61','62','63','64','65','66','67','68','69','70','71','72','73','74','75','76','77','78','79','80'].includes(batch))
const root = '.artifacts/batch'+batch, sha = bytes => createHash('sha256').update(bytes).digest('hex')
const manifest = JSON.parse(await readFile(root + '/static-source-manifest.json'))
const stage = JSON.parse(await readFile(root + '/stage.json'))
assert.equal(sha(JSON.stringify(manifest)), stage.payloadFingerprint)
assert.equal(stage.fieldsActivated, false)
assert(manifest.length <= 20000)
assert.equal(new Set(manifest.map(row => row.path)).size, manifest.length)
let cursor = 0, checked = 0
await Promise.all(Array.from({ length: 8 }, async () => {
  while (cursor < manifest.length) {
    const row = manifest[cursor++]
    assert(!row.path.startsWith('/') && !row.path.includes('..'))
    const bytes = await readFile(root + '/deploy/pages-dist/' + row.path)
    assert.equal(bytes.length, row.bytes, row.path)
    assert.equal(sha(bytes), row.sha256, row.path)
    checked++
  }
}))
const fonts = JSON.parse(await readFile(batch==='80'?'.artifacts/reader-speed-20260921/client-pass3/font-cache-map.json':batch==='79'?'.artifacts/reader-speed-20260921/client-pass2/font-cache-map.json':batch==='78'?'.artifacts/reader-speed-20260921/client/font-cache-map.json':batch==='77'?'.artifacts/account-recovery-20260921/client/font-cache-map.json':['64','65','66','67','68','69','70','71','72','73','74','75','76','77'].includes(batch)?'.artifacts/performance-20260920/client-pass'+({'64':'8','65':'9','66':'11','67':'11','68':'12','69':'12','70':'13','71':'14','72':'15','73':'16','74':'17','75':'18','76':'17'}[batch])+'/font-cache-map.json':'.artifacts/performance-20260918/client-pass'+(['61','62','63'].includes(batch)?'6':batch==='60'?'5':batch==='59'?'4':'3')+'/font-cache-map.json'))
const sw = await readFile(root + '/deploy/pages-dist/sw.js', 'utf8')
const redirects = await readFile(root + '/deploy/pages-dist/_redirects', 'utf8')
for (const row of fonts) {
  assert(manifest.some(entry => entry.path === row.target))
  assert(!manifest.some(entry => entry.path === row.original.slice(1)))
  assert(sw.includes(row.target))
  assert(redirects.includes(`${row.original} /${row.target} 301`))
}
const report = { passed: true, checked, fonts: fonts.length, payloadFingerprint: stage.payloadFingerprint, fieldsActivated: false, checkedAt: new Date().toISOString() }
await writeFile(root + '/local-assets.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))

import { createHash } from 'node:crypto'

const ids = process.argv.slice(2).map(Number).filter(Number.isSafeInteger)
if (!ids.length) throw Error('usage: node tools/audit-quranpedia-book-candidates.mjs BOOK_ID [...]')

const sha256 = value => createHash('sha256').update(value).digest('hex')
const inventoryUrl = 'https://quranpedia.net/llms-full.txt'
const response = await fetch(inventoryUrl, { headers: { accept: 'text/plain', 'user-agent': 'Khizana-Waqf-Resource-Audit/1.0' } })
if (!response.ok) throw Error(`inventory_http_${response.status}`)
const inventory = Buffer.from(await response.arrayBuffer())
const lines = inventory.toString('utf8').split(/\r?\n/)

const probe = async url => {
  const result = await fetch(url, { headers: { accept: 'application/json, text/markdown, text/html', 'user-agent': 'Khizana-Waqf-Resource-Audit/1.0' } })
  const bytes = Buffer.from(await result.arrayBuffer())
  return { url, status: result.status, byteSize: bytes.length, checksumSha256: sha256(bytes) }
}

const candidates = []
for (const id of ids) {
  const bookPattern = new RegExp(`/book/${id}(?:\\.md)?$`)
  const surahPattern = new RegExp(`/surah/1/(\\d+)/book/${id}\\.md$`)
  const inventoryUrls = lines.filter(line => bookPattern.test(line) || surahPattern.test(line))
  const inventorySurahs = [...new Set(inventoryUrls.map(line => Number(surahPattern.exec(line)?.[1])).filter(Boolean))].sort((a, b) => a - b)
  candidates.push({
    id,
    inventory: { urlCount: inventoryUrls.length, surahCount: inventorySurahs.length, surahs: inventorySurahs },
    probes: await Promise.all([
      probe(`https://api.quranpedia.net/v1/book/${id}`),
      probe(`https://api.quranpedia.net/books-contents/book-${id}.json`),
      probe(`https://quranpedia.net/book/${id}.md`),
      probe(`https://quranpedia.net/surah/1/1/book/${id}.md`),
    ]),
  })
}

console.log(JSON.stringify({
  schemaVersion: 1,
  auditedAt: new Date().toISOString(),
  inventory: { url: inventoryUrl, byteSize: inventory.length, checksumSha256: sha256(inventory) },
  candidates,
}, null, 2))

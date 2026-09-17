import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const sha=b=>createHash('sha256').update(b).digest('hex')
// Derive ownership only from authenticated row shards, never catalog estimates.
const primary=resolve('artifacts/heading-search-central-v2')
const descriptor=JSON.parse(await readFile('app/src/heading_catalog_supplement.generated.json','utf8'))
const supplement=resolve('app/public',descriptor.baseURL)
async function build(base,locations){
 const raw=await readFile(resolve(base,'manifest.json')),manifest=JSON.parse(raw)
 const ranges=[];let rowCount=0;const packs=new Map()
 for(const shard of manifest.rows){
  let bytes;const location=locations?.[shard.path]
  if(location){if(!packs.has(location.path))packs.set(location.path,await readFile(resolve(base,location.path)));bytes=packs.get(location.path).subarray(location.offset,location.offset+location.bytes)}
  else bytes=await readFile(resolve(base,shard.path))
  assert.equal(bytes.length,shard.bytes);assert.equal(sha(bytes),shard.sha256)
  const rows=JSON.parse(bytes);assert.equal(rows.length,shard.count);assert.equal(rowCount,shard.firstRow)
  for(const row of rows){assert.equal(typeof row[0],'string');const last=ranges.at(-1);if(last?.[0]===row[0])last[2]++;else ranges.push([row[0],rowCount,1]);rowCount++}
 }
 assert.equal(rowCount,manifest.rowCount)
 // The release includes books with zero TOC rows; they have no range.
 assert(new Set(ranges.map(r=>r[0])).size<=manifest.bookCount)
 return {manifestSha256:sha(raw),rowCount,ranges}
}
const result={primary:await build(primary),supplement:await build(supplement,descriptor.locations)}
const output=resolve('app/src/heading_book_ranges.generated.json')
await writeFile(output,JSON.stringify(result))
console.log(JSON.stringify({output,primaryRows:result.primary.rowCount,supplementRows:result.supplement.rowCount,bytes:Buffer.byteLength(JSON.stringify(result))}))

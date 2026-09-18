// Read-only local measurement. No publication or changes to source archives.
import {readFile} from 'node:fs/promises'
import {build} from 'esbuild'
import {localSearchFetch} from './audit-server-search-prototype.mjs'
const fixture=JSON.parse(await readFile('.artifacts/batch13/snippet-browser-fixture.json','utf8'))
await build({stdin:{contents:"export {ShamelaSearchV2Client} from './app/src/shamela_search_v2.ts'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:'.artifacts/measure-phrase-client.mjs'})
const adapter=await localSearchFetch(fixture.source.releaseRoot,fixture.source.manifestPath)
globalThis.__SHAMELA_SEARCH_V2_PACKED__=adapter.config
const {ShamelaSearchV2Client}=await import('../.artifacts/measure-phrase-client.mjs')
const client=new ShamelaSearchV2Client(adapter.fetcher),manifest=await client.getPackedManifest()
let candidates
for(const word of ['سلعة','الا']){
 const start=Date.now(),entry=await client.packedTermEntry(word,manifest),value=await client.packedTermValue(word,manifest,entry)
 const rows=value[1],positions=rows.reduce((n,row)=>n+row[1].length,0)
 if(!candidates)candidates=new Map(rows.map(row=>[row[0],row[1]]))
 else{const keep=new Map();for(const row of rows){const anchor=candidates.get(row[0]);if(anchor){const set=new Set(row[1]);const surviving=anchor.filter(p=>set.has(p-2));if(surviving.length)keep.set(row[0],surviving)}}candidates=keep}
 console.log(JSON.stringify({word,bytes:entry.byteLength,sha256:entry.sha256,rows:rows.length,positions,candidates:candidates.size,ms:Date.now()-start}))
}

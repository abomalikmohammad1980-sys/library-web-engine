import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {localSearchFetch} from './audit-server-search-prototype.mjs'
import {positionFilterRoot,positionFilterConfig} from './position-filter-config.mjs'
import {snippetRecoveryConfig} from './snippet-recovery-config.mjs'
await build({stdin:{contents:"export {ShamelaSearchV2Client} from './app/src/shamela_search_v2.ts';export {mayContainPosition} from './app/src/search_position_filter.ts'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:'.artifacts/audit-position-client.mjs'})
const {ShamelaSearchV2Client,mayContainPosition}=await import('../.artifacts/audit-position-client.mjs'),fixture=JSON.parse(await readFile('.artifacts/batch13/snippet-browser-fixture.json','utf8')),adapter=await localSearchFetch(fixture.source.releaseRoot,fixture.source.manifestPath),origin='https://search-prototype.invalid'
globalThis.__SHAMELA_SEARCH_V2_PACKED__={...adapter.config,sourceRecovery:await snippetRecoveryConfig(origin),positionFilters:await positionFilterConfig(origin)}
const fetcher=async(input,init)=>{
 const url=new URL(String(input),origin)
 if(url.pathname.startsWith('/library/position-filters/'))return new Response(await readFile(positionFilterRoot+'/'+url.pathname.split('/').at(-1)))
 if(url.pathname.startsWith('/library/snippet-recovery/')){const relative=url.pathname.split('/').slice(4).join('/');assert.match(relative,/^(manifest\.json|corrections\.json|books\/\d+\.json)$/);return new Response(await readFile(relative==='corrections.json'?'release-artifacts/search-source-corrections-4ba908f1d2f92f69/corrections.json':'release-artifacts/snippet-source-recovery-aa8ba3b2ea338a83/'+relative))}
 return adapter.fetcher(input,init)
}
const oracle=new ShamelaSearchV2Client(fetcher),packed=await oracle.getPackedManifest(),get=async w=>(await oracle.packedTermValue(w,packed,await oracle.packedTermEntry(w,packed)))[1],anchor=await get('سلعة'),other=new Map((await get('الا')).map(r=>[r[0],new Set(r[1])]))
const descriptor=JSON.parse(await readFile(positionFilterRoot+'/descriptor.json')),filter=Buffer.concat(await Promise.all(descriptor.parts.map(p=>readFile(positionFilterRoot+'/'+p.path))))
let exact=0,probable=0
for(const row of anchor){const exactPositions=row[1].filter(p=>other.get(row[0])?.has(p-2)),possible=row[1].filter(p=>mayContainPosition(filter,row[0],p-2));if(exactPositions.length)exact++;if(possible.length)probable++;for(const p of exactPositions)assert(possible.includes(p))}
console.log(JSON.stringify({exact,probable,falseNegatives:0}))
const client=new ShamelaSearchV2Client(fetcher),start=Date.now(),query='ألا إن سلعة الله',first=await client.searchComplete(query,0,100),second=await client.searchComplete(query,100,100),last=await client.searchComplete(query,Math.max(0,first.total-1),100)
assert(first.coverageComplete);assert.equal(first.hits.length,Math.min(100,first.total));assert.equal(second.total,first.total);assert.equal(last.hits.length,1)
const report={exact,probable,falseNegatives:0,localOnly:true,query,total:first.total,first:first.hits.length,second:second.hits.length,last:last.hits.length,coverageComplete:first.coverageComplete,ms:Date.now()-start,networkBytes:first.networkBytes}
const docs=await client.searchDocuments(query,0,100),docs2=await client.searchDocuments(query,100,100),tail=await client.searchDocuments(query,200,100)
assert.equal(docs.hits.length,100);assert.equal(docs2.hits.length,100)
const all=[...docs.hits,...docs2.hits,...tail.hits];assert.equal(all.length,docs.totalDocuments);assert.equal(new Set(all.map(h=>h.id)).size,all.length);assert.equal(all.reduce((n,h)=>n+h.occurrenceCount,0),first.total)
report.paragraphPagination={documents:docs.totalDocuments,pages:[docs.hits.length,docs2.hits.length,tail.hits.length],allDistinct:true,occurrences:all.reduce((n,h)=>n+h.occurrenceCount,0)}
await writeFile('.artifacts/position-filter-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))

import {createServer} from 'vite'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const server=await createServer({configFile:'app/vite.config.ts',cacheDir:'.artifacts/vite-heading-speed-check',server:{watch:null},appType:'custom'})
const originalFetch=globalThis.fetch
let wireRequests=0
globalThis.fetch=(...args)=>{wireRequests++;return originalFetch(...args)}
try{
 const {CentralHeadingSearchClient}=await server.ssrLoadModule('/src/central_heading_search.ts')
 const {headingDictionaryOptions}=await server.ssrLoadModule('/src/heading_dictionary_release.ts')
 const release=JSON.parse(await readFile('app/src/heading_dictionary_release.generated.json'))
 const descriptor=JSON.parse(await readFile('artifacts/heading-search-central-v2/client-release.json'))
 const origin='https://khzanah.com/'
 let baseline
 for(const batchRanges of [false,true,true,false]){
  const concurrency=16,dictionary=await headingDictionaryOptions(origin,batchRanges)
  wireRequests=0
  let metrics,requests=0
  const client=new CentralHeadingSearchClient({baseURL:origin+'api/search/headings/'+release.parts.sourceManifestSha256+'/',planTokens:true,dictionaryBinary:descriptor.dictionaryBinary,...dictionary,fetch:async(...args)=>{requests++;return dictionary.fetch(...args)},rowConcurrency:concurrency,queryTimeoutMs:120000,onMetrics:m=>metrics=m})
  const start=performance.now(),result=await client.search('التوحيد',{limit:40})
  const identity={total:result.total,exact:result.totalExact,keys:result.hits.map(h=>`${h.bookId}:${h.titleId}`)}
  if(baseline)assert.deepEqual(identity,baseline);else baseline=identity
  console.log(JSON.stringify({batchRanges,concurrency,elapsedMs:Math.round(performance.now()-start),requests,wireRequests,metrics,...identity}))
 }
}finally{globalThis.fetch=originalFetch;await server.close()}

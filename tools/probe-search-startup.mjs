// Read-only diagnostic against an explicitly selected public preview.
import {build} from 'esbuild'
import {snippetRecoveryConfig} from './snippet-recovery-config.mjs'
import {positionFilterConfig} from './position-filter-config.mjs'
const origin=process.argv[2]
if(!/^https:\/\/[a-z0-9-]+\.khezana\.pages\.dev$/.test(origin??''))throw Error('preview_required')
await build({stdin:{contents:"export {ShamelaSearchV2Client} from './app/src/shamela_search_v2.ts';export {snippetPhraseOffsets} from './app/src/search_phrase_snippet_matches.ts';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:'.artifacts/search-startup-probe.mjs'})
globalThis.location=new URL(origin)
globalThis.__SHAMELA_SEARCH_V2_PACKED__={controlBaseUrl:origin+'/r2/khezana-search-v2-00/control',projectBaseUrls:Array.from({length:8},(_,i)=>origin+'/r2/khezana-search-v2-'+String(i).padStart(2,'0'))}
const {ShamelaSearchV2Client,snippetPhraseOffsets}=await import('../.artifacts/search-startup-probe.mjs')
if(process.argv.includes('--recovery'))globalThis.__SHAMELA_SEARCH_V2_PACKED__.sourceRecovery=await snippetRecoveryConfig(origin)
if(process.argv.includes('--batch'))globalThis.__SHAMELA_SEARCH_V2_PACKED__.batchRequests=true
if(process.argv.includes('--positions'))globalThis.__SHAMELA_SEARCH_V2_PACKED__.positionFilters=await positionFilterConfig(origin)
const start=Date.now()
let requests=0,batches=0;const diagnostic=process.argv.includes('--diagnostic'),deadline=AbortSignal.timeout(diagnostic?300000:110000)
const fetcher=async(input,init)=>{const url=new URL(String(input),origin);requests++;if(init?.method==='POST')batches++;if(requests%25===0)console.log(JSON.stringify({ms:Date.now()-start,requests,batches}));try{const r=await fetch(url,{...init,signal:AbortSignal.any([deadline,init?.signal??AbortSignal.timeout(60000)])});if(!r.ok)console.log(JSON.stringify({ms:Date.now()-start,status:r.status,path:url.pathname,reason:r.headers.get('x-search-batch-failure')}));return r}catch(e){console.log(JSON.stringify({ms:Date.now()-start,path:url.pathname,error:e.message}));throw e}}
const client=new ShamelaSearchV2Client(fetcher)
if(process.argv.includes('--serial-batches')){
 const original=client.fetcher;let active=0;const waiting=[]
 client.fetcher=async(...args)=>{if(active>=4)await new Promise(resolve=>waiting.push(resolve));active++;try{return await original(...args)}finally{active--;waiting.shift()?.()}}
}
if(diagnostic){const read=client.snippetRows.bind(client),term=client.packedTermValue.bind(client);let rows=0,hits=0;client.packedTermValue=async(...args)=>{const value=await term(...args);console.log(JSON.stringify({word:args[0],candidateRows:value[1].length}));return value};client.snippetRows=async(...args)=>{const value=await read(...args);rows+=value.length;hits+=value.reduce((n,row)=>n+snippetPhraseOffsets(row[3],'ألا إن سلعة الله').length,0);if(rows%256<value.length)console.log(JSON.stringify({ms:Date.now()-start,scanned:rows,matches:hits}));return value}}
const result=process.argv.includes('--complete')?await client.searchComplete('ألا إن سلعة الله',0,100):await client.search('ألا إن سلعة الله',0,100)
console.log(JSON.stringify({ms:Date.now()-start,requests,batches,total:result.total,hits:result.hits.length}))

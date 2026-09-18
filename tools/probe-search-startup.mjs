// Read-only diagnostic against an explicitly selected public preview.
import {build} from 'esbuild'
import {snippetRecoveryConfig} from './snippet-recovery-config.mjs'
const origin=process.argv[2]
if(!/^https:\/\/[a-z0-9-]+\.khezana\.pages\.dev$/.test(origin??''))throw Error('preview_required')
await build({entryPoints:['app/src/shamela_search_v2.ts'],bundle:true,platform:'node',format:'esm',outfile:'.artifacts/search-startup-probe.mjs'})
globalThis.location=new URL(origin)
globalThis.__SHAMELA_SEARCH_V2_PACKED__={controlBaseUrl:origin+'/r2/khezana-search-v2-00/control',projectBaseUrls:Array.from({length:8},(_,i)=>origin+'/r2/khezana-search-v2-'+String(i).padStart(2,'0'))}
const {ShamelaSearchV2Client}=await import('../.artifacts/search-startup-probe.mjs')
if(process.argv.includes('--recovery'))globalThis.__SHAMELA_SEARCH_V2_PACKED__.sourceRecovery=await snippetRecoveryConfig(origin)
if(process.argv.includes('--batch'))globalThis.__SHAMELA_SEARCH_V2_PACKED__.batchRequests=true
const start=Date.now()
let requests=0
const fetcher=async(input,init)=>{const url=new URL(String(input),origin);requests++;try{const r=await fetch(url,{...init,signal:init?.signal??AbortSignal.timeout(60000)});if(!r.ok)console.log(JSON.stringify({ms:Date.now()-start,status:r.status,path:url.pathname}));return r}catch(e){console.log(JSON.stringify({ms:Date.now()-start,path:url.pathname,error:e.message}));throw e}}
const result=await new ShamelaSearchV2Client(fetcher).search('ألا إن سلعة الله',0,100)
console.log(JSON.stringify({ms:Date.now()-start,requests,total:result.total,hits:result.hits.length}))

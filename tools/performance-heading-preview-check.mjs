// Read-only diagnostic of the real heading client against an approved Pages origin.
import {build} from 'esbuild'
import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const [origin,output]=process.argv.slice(2)
assert(/^https:\/\/(?:khzanah\.com|[a-z0-9-]+\.khezana\.pages\.dev)$/.test(origin))
assert(/^\.artifacts\/batch\d+\/[a-z-]+\.json$/.test(output))
const bundle=async path=>{
 const result=await build({entryPoints:[path],bundle:true,write:false,platform:'node',format:'esm'})
 return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
}
const [{CentralHeadingSearchClient},{headingDictionaryOptions}]=await Promise.all([bundle('app/src/central_heading_search.ts'),bundle('app/src/heading_dictionary_release.ts')])
const descriptor=JSON.parse(await readFile('artifacts/heading-search-central-v2/client-release.json','utf8'))
const options=await headingDictionaryOptions(origin+'/'),requests=[],metrics=[]
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('diagnostic_deadline')),90000)
const fetcher=options.fetch
options.fetch=async(input,init)=>{
 const start=performance.now(),url=String(input)
 try{const response=await fetcher(input,{...init,signal:AbortSignal.any([controller.signal,...(init?.signal?[init.signal]:[])])});requests.push({path:new URL(url).pathname,status:response.status,ms:Math.round(performance.now()-start)});return response}
 catch(error){requests.push({path:new URL(url).pathname,error:error.message,ms:Math.round(performance.now()-start)});throw error}
}
let result,error
try{
 const client=new CentralHeadingSearchClient({baseURL:new URL(descriptor.baseURL,origin).href,planTokens:true,dictionaryBinary:descriptor.dictionaryBinary,...options,rowConcurrency:4,queryTimeoutMs:85000,onMetrics:value=>metrics.push(value)})
 const start=performance.now(),page=await client.search('الجهاد ذروة سنام',{limit:100,signal:controller.signal})
 assert.equal(page.total,4);assert.equal(page.hits.length,4)
 result={total:page.total,hits:page.hits.length,ms:Math.round(performance.now()-start)}
}catch(failure){error=failure.message}
finally{clearTimeout(timer);controller.abort()}
const receipt={passed:!error,origin,checkedAt:new Date().toISOString(),scope:'read-only public transport; not browser UI acceptance',result,error,metrics,requests}
await writeFile(output,JSON.stringify(receipt,null,2))
console.log(JSON.stringify({passed:!error,result,error,requests:requests.length,last:requests.slice(-4)}))
if(error)process.exitCode=1

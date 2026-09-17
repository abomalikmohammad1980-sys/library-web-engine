import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
export function percentile95(values){
 assert(values.length>0&&values.every(Number.isFinite),'measurement_values')
 return [...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1]
}
export function sampleSeoPaths(paths,count=30){
 const unique=[...new Set(paths)].filter(path=>/^\/(books\/\d+|authors\/\d{6,12})$/.test(path))
 assert(unique.length>=count,'not_enough_public_urls')
 // Seeded shuffle makes the sample reproducible without selecting fast books.
 let seed=20260917
 for(let i=unique.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[unique[i],unique[j]]=[unique[j],unique[i]]}
 return unique.slice(0,count)
}
export async function measureSeoPreview(origin){
 const base=new URL(origin)
 assert(base.protocol==='https:'&&base.hostname.endsWith('.khezana.pages.dev'),'preview_only')
 const paths=[]
 for(const file of ['sitemap-books-001.xml','sitemap-authors.xml']){
  const response=await fetch(new URL('/'+file,base),{signal:AbortSignal.timeout(20000)})
  assert(response.ok,'sitemap_http');const xml=await response.text();assert(xml.length<3000000,'sitemap_budget')
  for(const m of xml.matchAll(/<loc>https:\/\/khzanah\.com([^<]+)<\/loc>/g))paths.push(m[1])
 }
 const rows=[]
 for(const path of sampleSeoPaths(paths)){
  const samples=[]
  for(let pass=0;pass<2;pass++){
   const start=performance.now(),response=await fetch(new URL(path,base),{signal:AbortSignal.timeout(20000)})
   const ttfbMs=performance.now()-start,html=await response.text(),totalMs=performance.now()-start
   assert.equal(response.status,200,path);assert.match(response.headers.get('x-robots-tag')??'',/noindex/)
   assert.equal((html.match(/<h1(?:\s|>)/g)??[]).length,1,path)
   samples.push({ttfbMs,totalMs,bytes:Buffer.byteLength(html)})
  }
  rows.push({path,first:samples[0],repeat:samples[1]})
 }
 const firstP95=percentile95(rows.map(row=>row.first.ttfbMs)),repeatP95=percentile95(rows.map(row=>row.repeat.ttfbMs))
 return{origin:base.origin,checkedAt:new Date().toISOString(),count:rows.length,firstP95,repeatP95,targetFirst800ms:firstP95<800,targetRepeat300ms:repeatP95<300,coldCacheProven:false,note:'Client-observed TTFB. First pass may already be cached at the edge; not a guaranteed cold-cache benchmark. No cache purge performed.',rows}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 assert(process.argv[2]&&process.argv[3],'preview_origin_and_output_required')
 const report=await measureSeoPreview(process.argv[2]);await writeFile(resolve(process.argv[3]),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({...report,rows:undefined}))
}

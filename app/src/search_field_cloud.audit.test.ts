import {expect,it,vi} from 'vitest'
import {ShamelaSearchV2Client} from './shamela_search_v2'
import {searchFieldReleaseBinding} from './search_field_release'
import {runInNewContext} from 'node:vm'
import {createHash} from 'node:crypto'
import * as snippets from './search_field_source_snippet'
import {writeFileSync,readFileSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'
const origin=process.env.KHIZANA_FIELD_PREVIEW_ORIGIN
it.skipIf(!origin)('deployed field configuration separates a real book and preserves pagination',async()=>{
 const base=new URL(origin!).origin
 if(!/^https:\/\/[a-z0-9-]+\.khezana\.pages\.dev$/.test(base))throw Error('isolated_preview_origin_required')
 vi.stubGlobal('location',{origin:base,hostname:new URL(base).hostname})
 const originalRange=snippets.searchFieldTokenSourceRange
 vi.spyOn(snippets,'searchFieldTokenSourceRange').mockImplementation((text,range)=>{
  try{return originalRange(text,range)}catch(error){writeFileSync('.artifacts/batch42/field-mismatch.json',JSON.stringify({text,range}));throw error}
 })
 let requests=0
 const remote:typeof fetch=async(input,init)=>{
  const url=new URL(String(input),base+'/');expect(url.origin).toBe(base)
  if(++requests>120)throw Error('cloud_audit_request_budget')
  return fetch(url,{...init,redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(20000),...(init?.signal?[init.signal]:[])])})
 }
 try{
  // Execute the same configuration assets delivered to the browser, not a
  // substitute local manifest or synthetic search response.
  const candidateRoot=process.env.KHIZANA_FIELD_CANDIDATE_ROOT??'.artifacts/batch42/deploy/pages-dist'
  const scripts=['/data/shamela-search-v2-packed.js',...(existsSync(resolve(candidateRoot,'data/batch35-search-candidate-config.js'))?['/data/batch35-search-candidate-config.js']:[])]
  for(const path of scripts){
   const response=await remote(base+path);expect(response.status).toBe(200)
   const source=await response.text(),expected=readFileSync(resolve(candidateRoot,path.slice(1)))
   const sha=(b:string|Uint8Array)=>createHash('sha256').update(b).digest('hex')
   expect(sha(source)).toBe(sha(expected))
   const target:Record<string,unknown>={}
   runInNewContext(source,{globalThis:target,location:{origin:base}},{timeout:1000})
   for(const [name,value] of Object.entries(target))vi.stubGlobal(name,value)
  }
  const binding=searchFieldReleaseBinding()!;expect(binding).toBeDefined()
  const client=new ShamelaSearchV2Client(remote),ids=['21633']
  const body=await client.searchSeparated('الاستلقاء','body',binding,0,1,ids)
  expect(body.coverageComplete).toBe(true);expect(body.totalDocuments).toBe(2);expect(body.hits).toHaveLength(1)
  const second=await client.searchSeparated('الاستلقاء','body',binding,1,1,ids)
  expect(second.totalDocuments).toBe(2);expect(second.hits).toHaveLength(1);expect(second.hits[0]!.id).not.toBe(body.hits[0]!.id)
  const foot=await client.searchSeparated('المخطوط','foot',binding,0,100,ids)
  expect(foot.totalDocuments).toBe(1);expect(foot.hits[0]!.text).toContain('المخطوط')
  expect((await client.searchSeparated('المخطوط','body',binding,0,100,ids)).totalDocuments).toBe(0)
  expect((await client.searchSeparated('الاستلقاء','foot',binding,0,100,ids)).totalDocuments).toBe(0)
  const cancelled=new AbortController();cancelled.abort();const before=requests
  await expect(client.searchSeparated('الاستلقاء','body',binding,0,100,ids,cancelled.signal)).rejects.toBeDefined()
  expect(requests).toBe(before)
  console.log(JSON.stringify({fieldCloudAcceptance:true,origin:base,requests,bookId:'21633',bodyDocuments:2,footDocuments:1,pagination:true,cancellation:true,productionActivated:false}))
 }finally{vi.restoreAllMocks();vi.unstubAllGlobals();Reflect.deleteProperty(globalThis,'__KHIZANA_SEARCH_FIELDS__');Reflect.deleteProperty(globalThis,'__SHAMELA_SEARCH_V2_PACKED__');Reflect.deleteProperty(globalThis,'__PUBLIC_BOOK_SEARCH_ENABLED__')}
},180000)

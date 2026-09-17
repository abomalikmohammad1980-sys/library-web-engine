// Read-only, pinned isolated public endpoints. No credentials and no dispatch.
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {ISOLATED} from './prepare-stageb-format-fixtures.mjs'
const ids=new Set(['codex-stageb-markdown','codex-stageb-epub','codex-stageb-pdf-bookmarks','codex-stageb-pdf-no-bookmarks'])
export async function observeStageBFormats(plan,fetcher=fetch){
 if(plan?.isolated?.origin!==ISOLATED.origin||plan.isolated.databaseId!==ISOLATED.databaseId||!Array.isArray(plan.manifest)||plan.manifest.length!==4||new Set(plan.manifest.map(f=>f.id)).size!==4||plan.manifest.some(f=>!ids.has(f.id)))throw Error('isolated_fixture_plan_required')
 const report=[]
 for(const f of plan.manifest){
  const response=await fetcher(ISOLATED.origin+'/books/public/'+f.id,{redirect:'error',signal:AbortSignal.timeout(30000)})
  assert.equal(response.status,200,'public fixture metadata status')
  const html=await response.text();assert(html.includes(f.title),'public fixture title');assert.match(html,/<h1\b/);assert.ok(!html.includes(f.key),'storage key must not escape')
  const counts={}
  for(const [field,q,expected] of [['body',f.bodyQuery,f.mime==='application/pdf'?0:1],['heading',f.headingQuery??'stageb_no_heading_expected',f.headingQuery?1:0]]){
   const params=new URLSearchParams({q,field,book:f.id,mode:'exact',limit:'100'})
   const result=await fetcher(ISOLATED.origin+'/api/search/public-books?'+params,{redirect:'error',signal:AbortSignal.timeout(30000)})
   assert.equal(result.status,200,'public search status');const value=await result.json();assert.equal(value.contract,'public-book-search/1');assert.equal(value.totalDocuments,expected);assert(value.hits.every(h=>h.bookId===f.id));if(f.mime==='application/pdf')assert(value.hits.every(h=>h.field!=='body'),'PDF body is forbidden');counts[field]=value.totalDocuments
  }
  if(f.headingQuery)assert(html.includes(f.headingQuery),'verified TOC must appear in server HTML')
  report.push({bookId:f.id,metadata:200,...counts,expectedState:f.expectedStatus})
 }
 return{origin:ISOLATED.origin,publicChecks:report,queueAndActions:'Verify observe.sql separately; public GET success alone is not Queue/Actions proof'}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--plan')throw Error('usage_plan_required');const plan=JSON.parse(await readFile(args[1],'utf8'));console.log(JSON.stringify(await observeStageBFormats(plan)))}

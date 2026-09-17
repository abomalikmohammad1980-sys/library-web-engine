// Synthetic fixture only. Secret is inherited from the parent process, never logged.
import assert from 'node:assert/strict'
import {ingestionGateway,ingestionRuntimeConfig,drainPublicBookIndex} from './public-book-index-runner.mjs'
const origin='https://khizana-bok-acceptance-20260917.pages.dev'
if(process.env.PUBLIC_BOOK_INDEX_GATEWAY_ORIGIN!==origin)throw Error('acceptance_origin_required')
const fixture='00000000-codex-ingestion-acceptance'
const underlying=ingestionGateway(ingestionRuntimeConfig(process.env))
const gateway=async(input,...args)=>{
 const result=await underlying(input,...args)
 if(input.op==='claim'&&result.job&&result.job.book_id!==fixture){
  await underlying({op:'fail',lease:result.job,code:'acceptance_fixture_only'})
  throw Error('unexpected_acceptance_fixture')
 }
 return result
}
const result=await drainPublicBookIndex({gateway,maxJobs:1})
assert.equal(result.claimed,1,'synthetic fixture must be freshly queued')
assert.equal(result.ready,1,'synthetic fixture must reach verified artifact + search activation')
assert.equal(result.failed,0)
const searchUrl=new URL('/api/search/public-books',origin)
searchUrl.search=new URLSearchParams({q:'acceptance',field:'body',mode:'exact',book:fixture,limit:'100'}).toString()
const response=await fetch(searchUrl,{redirect:'error',signal:AbortSignal.timeout(30000)})
assert.equal(response.status,200,'public search consumer must be enabled')
assert.match(response.headers.get('Cache-Control')??'',/no-store/)
const search=await response.json()
assert.equal(search.contract,'public-book-search/1');assert.equal(search.totalDocuments,2)
assert.equal(search.hits.length,2);assert.ok(search.hits.every(hit=>hit.bookId===fixture))
assert.ok(!JSON.stringify(search).includes('ingestion-acceptance/source.txt'))
console.log(JSON.stringify({origin,fixture,...result,searchHits:search.hits.length}))

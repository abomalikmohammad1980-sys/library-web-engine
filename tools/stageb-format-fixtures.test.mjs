import test from 'node:test'
import assert from 'node:assert/strict'
import {buildStageBFormatFixtures,stageBSeedSql,assertIsolatedConfig,ISOLATED} from './prepare-stageb-format-fixtures.mjs'
import {extractPublicBookBounded} from './public-book-index-executor.mjs'
import {observeStageBFormats} from './observe-stageb-format-fixtures.mjs'
test('four generated format fixtures exercise actual parsers, native TOCs and no PDF body',async()=>{
 const files=await buildStageBFormatFixtures();assert.equal(files.length,4)
 for(const f of files){const out=await extractPublicBookBounded({mime:f.mime,bytes:f.bytes});if(f.mime==='application/pdf'){assert.deepEqual(out.rows,[]);assert.equal(out.pdfClassification.kind,'scanned');assert.equal(out.headings.length,f.headingQuery?1:0)}else assert(out.rows.some(row=>new RegExp('(^|\\s)'+f.bodyQuery+'(?=\\s|$)').test(row.text)),'body token must retain its block boundary: '+f.kind);if(f.headingQuery)assert(out.headings.some(h=>h.value.includes(f.headingQuery)))}
 const seed=stageBSeedSql(files);assert.doesNotMatch(seed,/DELETE|UPDATE|super-admin/);assert.equal((seed.match(/INSERT INTO user_books/g)??[]).length,4)
})
test('operator plan refuses production or mixed D1 bindings',()=>{
 assert.throws(()=>assertIsolatedConfig('database_id="production"'),/isolated/)
 const valid=`database_id="${ISOLATED.databaseId}"\nbucket_name="${ISOLATED.bucket}"`
 assert.doesNotThrow(()=>assertIsolatedConfig(valid));assert.throws(()=>assertIsolatedConfig(valid+'\ndatabase_id="other"'),/isolated/)
 assert.doesNotThrow(()=>assertIsolatedConfig(JSON.stringify({d1_databases:[{binding:'VISITORS_DB',database_id:ISOLATED.databaseId}],r2_buckets:[{bucket_name:ISOLATED.bucket}]})))
})
test('read-only observer is pinned and rejects any PDF body result',async()=>{
 const manifest=await buildStageBFormatFixtures(),plan={isolated:ISOLATED,manifest}
 const fetcher=async value=>{const url=new URL(value),id=url.searchParams.get('book')??url.pathname.split('/').at(-1),f=manifest.find(f=>f.id===id);if(!url.pathname.startsWith('/api/'))return new Response(`<h1>${f.title}</h1>${f.headingQuery??''}`);const field=url.searchParams.get('field'),count=field==='body'?(f.mime==='application/pdf'?0:1):(f.headingQuery?1:0);return Response.json({contract:'public-book-search/1',totalDocuments:count,hits:count?[{bookId:id,field}]:[]})}
 assert.equal((await observeStageBFormats(plan,fetcher)).publicChecks.length,4)
 await assert.rejects(observeStageBFormats({...plan,isolated:{...ISOLATED,origin:'https://khzanah.com'}},()=>{throw Error('must_not_fetch')}),/isolated/)
 await assert.rejects(observeStageBFormats(plan,async value=>{const response=await fetcher(value);if(String(value).includes('/api/')&&String(value).includes('pdf-bookmarks'))return Response.json({contract:'public-book-search/1',totalDocuments:0,hits:[{bookId:'codex-stageb-pdf-bookmarks',field:'body'}]});return response}),/PDF body/)
})

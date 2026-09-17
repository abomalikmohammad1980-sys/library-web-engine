// Read-only external acceptance. Does not claim/extract jobs, send wake calls, or read credentials.
import assert from 'node:assert/strict'
const origin='https://khizana-bok-acceptance-20260917.pages.dev',fixture='00000000-codex-ingestion-acceptance'
if(process.env.PUBLIC_BOOK_INDEX_GATEWAY_ORIGIN!==origin)throw Error('isolated_acceptance_origin_required')
async function read(path){const response=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);assert.match(response.headers.get('x-robots-tag')??'',/noindex/);assert.match(response.headers.get('cache-control')??'',/no-store/);return response}
const search=await(await read('/api/search/public-books?'+new URLSearchParams({q:'acceptance',field:'body',mode:'exact',book:fixture,limit:'100'}))).json()
assert.equal(search.contract,'public-book-search/1');assert.equal(search.totalDocuments,2);assert.equal(search.hits.length,2);assert.ok(search.hits.every(hit=>hit.bookId===fixture))
assert.ok(!JSON.stringify(search).includes('ingestion-acceptance/source.txt'))
const html=await(await read('/books/public/'+fixture)).text()
assert.equal((html.match(/<h1(?:\s|>)/gi)??[]).length,1)
assert.match(html,/<title>[^<]*Isolated (?:Stage B|ingestion) acceptance/)
assert.match(html,new RegExp('https://khzanah\\.com/books/public/'+fixture))
assert.ok(!html.includes('ingestion-acceptance/source.txt'))
const sitemap=await(await read('/sitemap-public.xml')).text()
assert.ok(sitemap.includes('https://khzanah.com/books/public/'+fixture))
console.log(JSON.stringify({origin,fixture,searchHits:search.hits.length,htmlH1:1,sitemapContainsFixture:true,scope:'consumer proof only; Queue/Actions receipts require separate D1 verification'}))

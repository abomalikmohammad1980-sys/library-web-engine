import test from 'node:test'
import assert from 'node:assert/strict'
import {buildSeoListings} from './build-seo-listings.mjs'
import {readSeoListing,renderSeoListing,listingPageUrl,visibleSeoListingRows,relatedSeoRows} from '../alpha-publish/functions/_seo-listings.js'
const fixture=()=>buildSeoListings({generatedAt:'2026-09-17T00:00:00Z',authors:[{id:'000020',name:'مؤلف'}],books:Array.from({length:251},(_,i)=>({id:String(i+1),title:'عنوان '+i,authorId:'000020',category:'كتب الحديث'}))})
const assets=files=>({fetch:async url=>{const bytes=files.get(new URL(url).pathname.split('/').at(-1));return bytes?new Response(bytes):new Response('',{status:404})}})
test('bounded lists preserve every book over real author/category/browse page links',async()=>{
 const {files,report}=fixture();assert(report.assets<=512);assert(report.maxBytes<200000)
 for(const list of ['browse','new-books','author:000020','category:كتب الحديث']){
  const ids=[];for(let page=1;page<=3;page++){const r=await readSeoListing(assets(files),'https://preview.test',list,page);assert.equal(r.pages,3);assert.equal(r.total,251);ids.push(...r.rows.map(row=>row.id))}
  assert.equal(new Set(ids).size,251);assert.equal(ids.length,251)
  assert.equal(await readSeoListing(assets(files),'https://preview.test',list,4),null)
 }
 const page=await readSeoListing(assets(files),'https://preview.test','author:000020',2),html=renderSeoListing(page,'/authors/000020')
 assert.match(html,/href="\/authors\/000020"/);assert.match(html,/href="\/authors\/000020\?page=3"/)
 assert.equal(listingPageUrl('/authors',1),'/authors');assert.equal(listingPageUrl('/authors',2),'/authors?page=2')
})
test('current alias withdrawal filters links before related-book projection',async()=>{
 const r=await readSeoListing(assets(fixture().files),'https://preview.test','author:000020')
 let statements=0
 const db={prepare:sql=>({bind:(...args)=>({all:async()=>{statements++;assert(args.length<=75);assert.match(sql,/logically_deleted_at IS NOT NULL/);return{results:[{book_id:'shamela-2'},{book_id:'410000003'}]}}})})}
 const visible=await visibleSeoListingRows(db,r.rows),related=relatedSeoRows(visible,'1')
 assert.equal(statements,4);assert.equal(related.length,12);assert(related.every(row=>!['1','2','3'].includes(row.id)))
 assert.doesNotMatch(renderSeoListing(r,'/browse',visible),/href="\/books\/(2|3)"/)
})
test('malformed or oversized assets fail closed and category labels are escaped',async()=>{
 await assert.rejects(readSeoListing({fetch:async()=>new Response('x'.repeat(200001))},'https://preview.test','authors'),/size/)
 assert.throws(()=>listingPageUrl('//evil.test',2))
 const html=renderSeoListing({page:1,pages:1,rows:[{title:'<script>',href:'/books/1'}]},'/browse')
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/)
})
test('R2 variant uses only release-bound keys, avoiding the Pages asset ceiling',async()=>{
 const {files,report}=fixture(),keys=[]
 const bucket={get:async key=>{keys.push(key);const bytes=files.get(key.split('/').at(-1));return bytes?{size:bytes.length,body:new Response(bytes).body}:null}}
 const r=await readSeoListing(null,'https://preview.test','authors',1,{bucket,releaseId:report.releaseId})
 assert.equal(r.rows[0].id,'000020');assert(keys.every(key=>key.startsWith(`seo/listings/${report.releaseId}/lists-`)))
 await assert.rejects(readSeoListing(null,'https://preview.test','authors',1,{bucket,releaseId:'../../private'}),/release/)
})

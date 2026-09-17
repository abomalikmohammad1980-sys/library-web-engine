import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readPublicSeoToc} from '../alpha-publish/functions/_seo-public-toc.js'

function fixture({pdf=false,pending=false,changed=false,corrupt=false}={}){
 const artifact={contract:'public-book-index/1',bookId:'upload',generation:3,sourceSha256:'a'.repeat(64),parserVersion:'bounded-account-v1',title:'كتاب',author:'مؤلف',coverageMode:pdf?'pdf-bookmarks-only':'text-and-headings',rows:pdf?[]:[{text:'SECRET-BODY-NOT-FOR-SEO',paragraphIndex:8}],headings:[{value:'عنوان',paragraphIndex:8},{value:'صفحة',pageIndex:3},{value:'موضع غير معروف'}]}
 const bytes=Buffer.from(JSON.stringify(artifact)),sha=createHash('sha256').update(bytes).digest('hex')
 let reads=0,queries=0
 const receipt={generation:3,manifest_sha256:sha,artifact_key:`public-book-index/v1/${sha}.json`,parser_version:artifact.parserVersion,coverage_mode:artifact.coverageMode}
 const env={VISITORS_DB:{prepare:sql=>({bind:id=>({first:async()=>{
  assert.equal(id,'upload');assert.match(sql,/public_book_index_eligible/);queries++
  return pending||(changed&&queries>1)?null:receipt
 }})})},LIBRARY_R2:{get:async key=>{
  reads++;assert.equal(key,receipt.artifact_key)
  return{size:bytes.length,body:new Response(corrupt?Buffer.alloc(bytes.length):bytes).body}
 }}}
 return{env,reads:()=>reads}
}
test('ready public TOC uses actual reader anchors and never returns source body',async()=>{
 const f=fixture(),toc=await readPublicSeoToc(f.env,'upload')
 assert.deepEqual(toc.rows,[{title:'عنوان',href:'/books/public/upload?para=8'},{title:'صفحة',href:'/books/public/upload?pageIndex=3'},{title:'موضع غير معروف',href:null}])
 assert.equal(toc.generation,3);assert.equal(JSON.stringify(toc).includes('SECRET-BODY'),false)
})
test('pending or ineligible generation performs no object load and claims no TOC',async()=>{
 const f=fixture({pending:true});assert.equal(await readPublicSeoToc(f.env,'upload'),null);assert.equal(f.reads(),0)
})
test('withdrawal or source replacement during read fails closed',async()=>{
 const f=fixture({changed:true});assert.equal(await readPublicSeoToc(f.env,'upload'),null)
})
test('corrupt hash fails closed without a guessed table of contents',async()=>{
 const f=fixture({corrupt:true});assert.equal(await readPublicSeoToc(f.env,'upload'),null)
})
test('PDF projects bookmarks only and never guesses paragraphs as pages',async()=>{
 const f=fixture({pdf:true}),toc=await readPublicSeoToc(f.env,'upload')
 assert.equal(toc.coverageMode,'pdf-bookmarks-only');assert.equal(toc.rows[0].href,null)
 assert.equal(toc.rows[1].href,'/books/public/upload?pageIndex=3')
})

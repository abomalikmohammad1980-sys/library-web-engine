import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const {zipSync,strToU8}=createRequire(new URL('../app/package.json',import.meta.url))('fflate')
import {extractPublicEpub} from './public-book-index-epub.mjs'
import {extractPublicBookBounded} from './public-book-index-executor.mjs'
const fixture=(version=2,href='two.xhtml#heading')=>{
 const files={mimetype:'application/epub+zip','META-INF/container.xml':'<container><rootfile full-path="OPS/book.opf"/></container>','OPS/book.opf':`<package><metadata><dc:title>كتاب عربي</dc:title></metadata><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/>${version===3?'<item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>':version===2?'<item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>':''}</manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>`,'OPS/one.xhtml':'<html><body><h1>أول</h1><p>متن عربي أول</p><script>danger()</script></body></html>','OPS/two.xhtml':'<html><body><h1 id="heading">ثان</h1><p>متن عربي ثان</p></body></html>','OPS/toc.ncx':`<ncx><navMap><navPoint><navLabel><text>عنوان أصلي</text></navLabel><content src="${href}"/></navPoint></navMap></ncx>`,'OPS/nav.xhtml':`<html><body><nav epub:type="toc"><ol><li><a href="${href}">عنوان أصلي</a></li></ol></nav></body></html>`}
 return zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)])))
}
test('EPUB2 native NCX and EPUB3 native nav preserve chapter reader anchors',()=>{
 for(const version of [2,3]){const result=extractPublicEpub(fixture(version));assert.equal(result.rows.length,2);assert.match(result.rows[0].text,/متن عربي أول/);assert.doesNotMatch(result.rows[0].text,/danger/);assert.deepEqual(result.headings,[{value:'عنوان أصلي',pageIndex:1,volumeIndex:0}])}
})
test('missing native TOC never fabricates chapter-title headings',()=>{assert.deepEqual(extractPublicEpub(fixture(0)).headings,[])})
test('external or missing EPUB3 TOC destinations fail closed',()=>{
 assert.throws(()=>extractPublicEpub(fixture(3,'https://evil.test/two.xhtml')),/epub_external_navigation/)
 assert.throws(()=>extractPublicEpub(fixture(3,'missing.xhtml')),/epub_navigation_target_missing/)
})
test('actual bounded extraction worker accepts EPUB and emits the same contract',async()=>{
 const result=await extractPublicBookBounded({mime:'application/epub+zip',bytes:fixture(2)})
 assert.equal(result.coverageMode,'text-and-headings');assert.equal(result.headings[0].pageIndex,1)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {createRequire} from 'node:module'
import {extractPublicBookBounded} from './public-book-index-executor.mjs'
import {extractFromDocx} from '../packages/ooxml-model/dist/index.js'
const require=createRequire(new URL('../packages/ooxml-model/package.json',import.meta.url))
const {zipSync,strToU8}=require('fflate')
const mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const document='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:r><w:t>عنوان موثق</w:t></w:r></w:p></w:body></w:document>'
const zip=(xml,extra={},options={})=>zipSync({'[Content_Types].xml':strToU8('<Types/>'),'word/document.xml':strToU8(xml),...extra},options)
test('DOCX larger than 1 MiB preserves text and bound reader anchors',async()=>{
 const bytes=zip(document,{'word/media/image1.png':randomBytes(2*1024*1024)})
 assert.ok(bytes.length>1024*1024)
 const paragraphs=extractFromDocx(bytes).paragraphs.map(p=>({paragraphIndex:p.index,text:p.text,physicalPage:1}))
 const out=await extractPublicBookBounded({mime,bytes,map:{totalPages:1,paragraphCount:paragraphs.length,paragraphs}})
 assert.deepEqual(out.rows.map(r=>r.text),['عنوان موثق']);assert.equal(out.rows[0].pageIndex,0)
 assert.deepEqual(out.headings.map(h=>h.value),['عنوان موثق'])
})
test('larger DOCX support retains XML size, ZIP expansion and entity rejection',async()=>{
 const oversizedXml=zip('x'.repeat(16*1024*1024+1),{}, {level:0})
 const expansion=zip(document,{'word/media/image1.png':new Uint8Array(2*1024*1024)})
 const entities=zip('<!DOCTYPE x [<!ENTITY x "unsafe">]>'+document)
 for(const bytes of [oversizedXml,expansion,entities])await assert.rejects(extractPublicBookBounded({mime,bytes,map:{}}),/unsafe_word_archive/)
 assert.throws(()=>extractPublicBookBounded({mime,bytes:new Uint8Array(20*1024*1024+1)}),/source_size_bound/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {createRequire} from 'node:module'
import {extractPublicBookBounded} from './public-book-index-executor.mjs'
import {extractFromDocx} from '../packages/ooxml-model/dist/index.js'
import {safeWordUpload} from '../deployment/cloudflare/functions/api/_word-upload-safety.js'
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
 // Test the XML ceiling directly, independently of the worker source ceiling.
 const oversizedXml=zip('x'.repeat(64*1024*1024+1),{}, {level:0})
 assert.equal(await safeWordUpload(new File([oversizedXml],'oversized.docx')),false)
 const expansion=zip(document,{'word/media/image1.png':new Uint8Array(2*1024*1024)})
 const entities=zip('<!DOCTYPE x [<!ENTITY x "unsafe">]>'+document)
 for(const bytes of [expansion,entities])await assert.rejects(extractPublicBookBounded({mime,bytes,map:{}}),/unsafe_word_archive/)
 assert.throws(()=>extractPublicBookBounded({mime,bytes:new Uint8Array(20*1024*1024+1)}),/source_size_bound/)
})

test('actual indexing worker accepts navigation mail links but rejects active external resources',async()=>{
 const relationship=(target,type='hyperlink')=>strToU8(`<Relationships><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" TargetMode="External" Target="${target}"/></Relationships>`)
 for(const target of ['mailto:reader@example.test','https://example.test/']){
  const bytes=zip(document,{'word/_rels/document.xml.rels':relationship(target)})
  const result=await extractPublicBookBounded({mime,bytes})
  assert.deepEqual(result.rows.map(row=>row.text),['عنوان موثق'])
 }
 for(const [target,type] of [['file:///c:/x','hyperlink'],['javascript:alert(1)','hyperlink'],['https://example.test/image','image']]){
  const bytes=zip(document,{'word/_rels/document.xml.rels':relationship(target,type)})
  await assert.rejects(extractPublicBookBounded({mime,bytes}),/unsafe_word_archive/)
 }
})

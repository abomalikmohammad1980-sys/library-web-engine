// Clean-checkout runtime proof: generated fixtures only, no account/Cloudflare I/O.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import {extractPublicBookBounded} from './public-book-index-executor.mjs'
import {extractFromDocx} from '../packages/ooxml-model/dist/index.js'
const modelRequire=createRequire(new URL('../packages/ooxml-model/package.json',import.meta.url))
const {zipSync,strToU8}=modelRequire('fflate')

test('both workflow jobs restore every statically imported server helper',()=>{
 const source=readFileSync(new URL('./public-book-index-executor.mjs',import.meta.url),'utf8')+readFileSync(new URL('./public-book-index-extract-worker.mjs',import.meta.url),'utf8')
 const workflow=readFileSync(new URL('../.github/workflows/public-book-ingestion.yml',import.meta.url),'utf8')
 const targeted=readFileSync(new URL('../.github/workflows/public-book-ingestion-targeted.yml',import.meta.url),'utf8')
 for(const match of source.matchAll(/from ['"]\.\.\/alpha-publish\/functions\/api\/([^'"]+)['"]/g)){
  const command=`cp deployment/cloudflare/functions/api/${match[1]} alpha-publish/functions/api/`
  assert.equal(workflow.split(command).length-1,2,`Both jobs must restore ${match[1]}`)
  assert.equal(targeted.split(command).length-1,1,`Targeted job must restore ${match[1]}`)
 }
})
test('clean runtime imports and parses UTF8 text',async()=>{
 assert.equal(process.env.PUBLIC_BOOK_INDEX_RUNNER_TOKEN,undefined)
 const out=await extractPublicBookBounded({mime:'text/plain; charset=utf-8',bytes:Buffer.from('نص أول\n\nنص ثان')})
 assert.deepEqual(out.rows.map(r=>r.text),['نص أول','نص ثان'])
})
test('clean runtime resolves pinned jsdom and preserves actual Markdown bookmarks',async()=>{
 const out=await extractPublicBookBounded({mime:'text/markdown',bytes:Buffer.from('# عنوان\n\nمتن موثق\n\n<script>UNTRUSTED_SCRIPT</script>')})
 assert.deepEqual(out.headings.map(h=>h.bookmark),['md-عنوان'])
 assert.ok(!JSON.stringify(out).includes('UNTRUSTED_SCRIPT'))
})
test('clean runtime uses explicitly built Word model and source-bound page map',async()=>{
 const bytes=zipSync({'[Content_Types].xml':strToU8('<Types/>'),'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:r><w:t>عنوان صحيح</w:t></w:r></w:p><w:p><w:r><w:t>نص محفوظ</w:t></w:r></w:p></w:body></w:document>')})
 const paragraphs=extractFromDocx(bytes).paragraphs.map(p=>({paragraphIndex:p.index,text:p.text,physicalPage:1}))
 const out=await extractPublicBookBounded({mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',bytes,map:{totalPages:1,paragraphCount:paragraphs.length,paragraphs}})
 assert.equal(out.rows.length,2);assert.deepEqual(out.headings.map(h=>h.value),['عنوان صحيح'])
})
test('clean platform PDF runtime uses only generated bookmark, not page body',async()=>{
 const appRequire=createRequire(new URL('../app/package.json',import.meta.url)),{PDFDocument,PDFName,PDFString}=appRequire('pdf-lib')
 const pdf=await PDFDocument.create(),page=pdf.addPage();page.drawText('BODY_MUST_NOT_BE_INDEXED')
 const outlines=pdf.context.obj({Type:'Outlines'}),root=pdf.context.register(outlines)
 const item=pdf.context.obj({Title:PDFString.of('Bookmark'),Parent:root,Dest:[page.ref,PDFName.of('Fit')]}),ref=pdf.context.register(item)
 outlines.set(PDFName.of('First'),ref);outlines.set(PDFName.of('Last'),ref);outlines.set(PDFName.of('Count'),pdf.context.obj(1));pdf.catalog.set(PDFName.of('Outlines'),root)
 const out=await extractPublicBookBounded({mime:'application/pdf',bytes:await pdf.save()})
 assert.deepEqual(out.rows,[]);assert.deepEqual(out.headings,[{value:'Bookmark',pageIndex:0}])
})

test('clean platform PDF ignores obsolete native flag and emits bookmarks plus classification only',async()=>{
 const appRequire=createRequire(new URL('../app/package.json',import.meta.url)),{PDFDocument}=appRequire('pdf-lib')
 const pdf=await PDFDocument.create();pdf.addPage().drawText('NATIVE_TEXT_WITH_MORE_THAN_TWENTY_CHARACTERS')
 const out=await extractPublicBookBounded({mime:'application/pdf',bytes:await pdf.save(),PDF_TEXT_INDEXING:'true'})
 assert.deepEqual(out.rows,[]);assert.equal(out.pdfClassification.kind,'text');assert.equal(out.coverageMode,'pdf-bookmarks-only');assert.deepEqual(out.headings,[])
})

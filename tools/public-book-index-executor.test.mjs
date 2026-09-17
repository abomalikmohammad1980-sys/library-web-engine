import {test} from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readdirSync,readFileSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {claimPublicBookIndex,readPublicBookIndexReceipt} from '../alpha-publish/functions/api/_public-book-index-jobs.js'
import {executePublicBookIndex,extractPublicBookBounded} from './public-book-index-executor.mjs'
import {extractFromDocx} from '../packages/ooxml-model/dist/index.js'
import {parseBok} from '../app/src/bok_import.ts'
const require=createRequire(new URL('../packages/ooxml-model/package.json',import.meta.url)),{zipSync,strToU8}=require('fflate')
const hash=b=>createHash('sha256').update(b).digest('hex')
function fixture(mime='text/plain',bytes=Buffer.from('عنوان\n\nنص الكتاب')){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON')
 const dir=new URL('../alpha-publish/migrations/',import.meta.url)
 for(const name of readdirSync(dir).filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(name,dir),'utf8'))
 sql.exec("INSERT INTO accounts(subject,email) VALUES('owner','isolated@example.test')")
 sql.prepare("INSERT INTO user_books(id,owner_subject,title,author,object_key,mime_type,byte_length,visibility,review_status) VALUES('a','owner','عنوان','مؤلف','private/a',?,?,'public','approved')").run(mime,bytes.length)
 const db={prepare(query){let args=[];return{bind(...v){args=v;return this},async first(){return sql.prepare(query).get(...args)??null},async run(){return{meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}}}}
 const objects=new Map([['private/a',Buffer.from(bytes)]])
 const r2={get:async key=>{const b=objects.get(key);return b?{size:b.length,body:new Blob([b]).stream()}:null},put:async(key,b)=>{objects.set(key,Buffer.from(b))}}
 return {sql,db,r2,objects,claim:()=>claimPublicBookIndex(db,{token:'isolated_worker_token',now:100}),run:async()=>executePublicBookIndex({db,r2,job:await claimPublicBookIndex(db,{token:'isolated_worker_token',now:100}),now:()=>101})}
}
test('all existing migrations coexist and actual text executor uploads verified artifact',async()=>{
 const f=fixture();try{const result=await f.run();assert.equal(result.ready,true);const payload=JSON.parse(f.objects.get(result.artifactKey));assert.deepEqual(payload.rows.map(x=>x.text),['عنوان','نص الكتاب']);assert.equal(payload.author,'مؤلف');assert.deepEqual(payload.headings,[]);assert.equal((await readPublicBookIndexReceipt(f.db,'a')).manifest_sha256,hash(f.objects.get(result.artifactKey)))}finally{f.sql.close()}
})
for(const mime of ['application/unknown'])test(`unsupported adapter never silently ready: ${mime}`,async()=>{
 const f=fixture(mime);try{const result=await f.run();assert.equal(result.ready,false);assert.match(result.error,/required|unsupported/);assert.equal(await readPublicBookIndexReceipt(f.db,'a'),null);assert.equal(f.objects.size,1)}finally{f.sql.close()}
})
test('R2 artifact corruption cannot activate',async()=>{
 const f=fixture();try{f.r2.put=async(key)=>f.objects.set(key,Buffer.from('corruption'));const result=await f.run();assert.equal(result.error,'artifact_digest_mismatch');assert.equal(await readPublicBookIndexReceipt(f.db,'a'),null)}finally{f.sql.close()}
})
test('withdrawal during R2 write fences activation and access',async()=>{
 const f=fixture();try{const put=f.r2.put;f.r2.put=async(...args)=>{await put(...args);f.sql.exec("UPDATE user_books SET visibility='private' WHERE id='a'")};assert.equal((await f.run()).error,'publication_changed');assert.equal(await readPublicBookIndexReceipt(f.db,'a'),null)}finally{f.sql.close()}
})
test('same-key source overwrite is detected before activation',async()=>{
 const f=fixture();try{const put=f.r2.put;f.r2.put=async(...args)=>{await put(...args);f.objects.set('private/a',Buffer.from('other bytes'))};assert.equal((await f.run()).error,'source_changed');assert.equal(await readPublicBookIndexReceipt(f.db,'a'),null)}finally{f.sql.close()}
})
test('real DOCX parser + integrity-bound Word map produces headings and source positions',async()=>{
 const bytes=zipSync({'[Content_Types].xml':strToU8('<Types/>'),'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:r><w:t>عنوان أصيل</w:t></w:r></w:p><w:p><w:r><w:t>نص محفوظ</w:t></w:r></w:p></w:body></w:document>')})
 const f=fixture('application/vnd.openxmlformats-officedocument.wordprocessingml.document',bytes)
 try{const paragraphs=extractFromDocx(bytes).paragraphs.map(p=>({paragraphIndex:p.index,text:p.text,physicalPage:1}));const mapBytes=Buffer.from(JSON.stringify({totalPages:1,paragraphCount:paragraphs.length,paragraphs}));f.objects.set('private/map',mapBytes);const manifest={contract:'khizana-word-bundle/1',sourceSha256:hash(bytes),mapSha256:hash(mapBytes),totalPages:1};f.sql.prepare('INSERT INTO user_book_word_bundles VALUES(?,?,?,?,?)').run('a',JSON.stringify(manifest),'private/map',mapBytes.length,hash(mapBytes));const result=await f.run();assert.equal(result.ready,true,result.error);const out=JSON.parse(f.objects.get(result.artifactKey));assert.deepEqual(out.headings.map(h=>h.value),['عنوان أصيل']);assert.equal(out.rows[0].pageIndex,0)}finally{f.sql.close()}
})
test('actual worker enforces time bound',async()=>{await assert.rejects(extractPublicBookBounded({mime:'text/plain',bytes:new Uint8Array([65])},{timeoutMs:1}),/extraction_timeout/)})
test('actual PDF.js extracts only valid bookmarks and exact page destinations, never body',async()=>{
 const appRequire=createRequire(new URL('../app/package.json',import.meta.url)),{PDFDocument,PDFName,PDFString}=appRequire('pdf-lib')
 const pdf=await PDFDocument.create(),page=pdf.addPage();page.drawText('BODY_SECRET_NOT_INDEXED')
 const outlines=pdf.context.obj({Type:'Outlines'}),root=pdf.context.register(outlines)
 const item=pdf.context.obj({Title:PDFString.of('BOOKMARK_ONLY'),Parent:root,Dest:[page.ref,PDFName.of('Fit')]});const ref=pdf.context.register(item)
 outlines.set(PDFName.of('First'),ref);outlines.set(PDFName.of('Last'),ref);outlines.set(PDFName.of('Count'),pdf.context.obj(1));pdf.catalog.set(PDFName.of('Outlines'),root)
 const bytes=await pdf.save(),f=fixture('application/pdf',bytes)
 try{const result=await f.run();assert.equal(result.ready,true,result.error);const out=JSON.parse(f.objects.get(result.artifactKey));assert.deepEqual(out.rows,[]);assert.deepEqual(out.headings,[{value:'BOOKMARK_ONLY',pageIndex:0}]);assert.equal(out.coverageMode,'pdf-bookmarks-only');assert.ok(!JSON.stringify(out).includes('BODY_SECRET'))}finally{f.sql.close()}
})
test('valid PDF without bookmarks is verified empty, corrupt PDF is never ready',async()=>{
 const appRequire=createRequire(new URL('../app/package.json',import.meta.url)),{PDFDocument}=appRequire('pdf-lib'),pdf=await PDFDocument.create();pdf.addPage()
 const result=await extractPublicBookBounded({mime:'application/pdf',bytes:await pdf.save()});assert.deepEqual(result.headings,[]);assert.deepEqual(result.rows,[])
 await assert.rejects(extractPublicBookBounded({mime:'application/pdf',bytes:new Uint8Array([65])}),/source_parse_failed/)
})
const bokPath=new URL('../../../كتب للاختبار/أعلام السنة المنشورة في صفة الطائفة المنصورة - عبد الرحمن العلي.bok',import.meta.url)
for(const mime of ['application/octet-stream','application/x-bok','application/x-shamela-bok'])test(`real BOK corpus preserves parser pages, ids and TOC anchors: ${mime}`,{skip:!existsSync(bokPath)},async()=>{
 const bytes=readFileSync(bokPath),expected=parseBok(bytes,'source.bok'),out=await extractPublicBookBounded({mime,bytes})
 assert.equal(out.rows.length,expected.pages.length);assert.equal(out.headings.length,expected.toc.length)
 for(let i=0;i<expected.pages.length;i++){assert.equal(out.rows[i].text,expected.pages[i].text);assert.equal(out.rows[i].pageIndex,i);assert.equal(out.rows[i].pageId,expected.pages[i].id)}
 for(let i=0;i<expected.toc.length;i++){const t=expected.toc[i],p=expected.pages.findIndex(x=>x.id===t.id);assert.equal(out.headings[i].value,t.title);assert.equal(out.headings[i].pageIndex,p<0?undefined:p)}
})
test('actual uploaded UTF8 MIME with charset follows existing text parser',async()=>{const out=await extractPublicBookBounded({mime:'text/plain; charset=utf-8',bytes:Buffer.from('نص صحيح')});assert.equal(out.rows[0].text,'نص صحيح')})
test('empty/oversized sources rejected before worker cloning, hostile Word never ready',async()=>{
 assert.throws(()=>extractPublicBookBounded({mime:'text/plain',bytes:new Uint8Array()}),/source_size_bound/)
 assert.throws(()=>extractPublicBookBounded({mime:'text/plain',bytes:new Uint8Array(20*1024*1024+1)}),/source_size_bound/)
 const bytes=zipSync({'[Content_Types].xml':strToU8('<Types/>'),'word/document.xml':strToU8('<!DOCTYPE x [<!ENTITY leak SYSTEM "file:///secret">]><x/>')})
 await assert.rejects(extractPublicBookBounded({mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',bytes,map:{}}),/unsafe_word_archive/)
})
test('Markdown uses actual sanitized reader pages/bookmarks, not fenced-code pseudo headings',async()=>{
 const md='# عُنوان\n\nنص\n\n# عُنوان\n\n```md\n# ليس عنوانا\n```\n\n<script>SECRET_SCRIPT</script>\n\n## فصل ثان\n\n![x](https://example.invalid/never-fetch)'
 const out=await extractPublicBookBounded({mime:'text/markdown; charset=utf-8',bytes:Buffer.from(md)})
 assert.deepEqual(out.headings.map(h=>h.bookmark),['md-عنوان','md-عنوان-2','md-فصل-ثان']);assert.ok(out.headings.every(h=>Number.isInteger(h.pageIndex)))
 assert.ok(!out.headings.some(h=>h.value==='ليس عنوانا'));assert.ok(!JSON.stringify(out).includes('SECRET_SCRIPT'))
 assert.ok(out.rows.some(r=>r.text.includes('نص')))
})

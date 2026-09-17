import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
const require=createRequire(new URL('../app/package.json',import.meta.url)),{zipSync,strToU8}=require('fflate'),{PDFDocument,PDFName,PDFString}=require('pdf-lib')
export const ISOLATED={origin:'https://khizana-bok-acceptance-20260917.pages.dev',bucket:'khizana-ingestion-acceptance-20260917',databaseId:'9133fe99-c4e1-4a1e-84f3-127735883279',databaseName:'khizana-bok-acceptance-20260917'}
const owner='codex-stageb-format-acceptance',sqlString=value=>"'"+String(value).replaceAll("'","''")+"'"
export async function buildStageBFormatFixtures(){
 const files=[]
 const add=(kind,mime,extension,bytes,bodyQuery,headingQuery)=>files.push({kind,id:'codex-stageb-'+kind,title:'قبول صيغة '+kind,author:'قبول تقني معزول',category:'اختبارات الفهرسة المعزولة',mime,file:kind+extension,key:'ingestion-acceptance/stageb-formats/'+kind+extension,bytes:Buffer.from(bytes),bodyQuery,headingQuery,expectedStatus:kind.startsWith('pdf-')?'ocr_pending':'ready'})
 add('markdown','text/markdown','.md',Buffer.from('# stagebmarkdownheading\n\nstagebmarkdownbody نص تجريبي لا ينتمي إلى كتاب حقيقي.'),'stagebmarkdownbody','stagebmarkdownheading')
 const epub={'mimetype':'application/epub+zip','META-INF/container.xml':'<container><rootfile full-path="OPS/book.opf"/></container>','OPS/book.opf':'<package><metadata><dc:title>قبول EPUB</dc:title></metadata><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/></spine></package>','OPS/one.xhtml':'<html><body><h1 id="chapter">stagebepubheading</h1><p>stagebepubbody نص تجريبي مستقل.</p></body></html>','OPS/nav.xhtml':'<html><body><nav epub:type="toc"><a href="one.xhtml#chapter">stagebepubheading</a></nav></body></html>'}
 add('epub','application/epub+zip','.epub',zipSync(Object.fromEntries(Object.entries(epub).map(([k,v])=>[k,strToU8(v)]))),'stagebepubbody','stagebepubheading')
 for(const hasBookmarks of [true,false]){
  const pdf=await PDFDocument.create();pdf.setCreationDate(new Date('2026-09-17T00:00:00Z'));pdf.setModificationDate(new Date('2026-09-17T00:00:00Z'))
  const page=pdf.addPage([300,400]);page.drawRectangle({x:40,y:40,width:220,height:320}) // synthetic non-text page, not a genuine OCR benchmark
  if(hasBookmarks){const outline=pdf.context.obj({Type:'Outlines'}),root=pdf.context.register(outline),item=pdf.context.register(pdf.context.obj({Title:PDFString.of('stagebpdfbookmark'),Parent:root,Dest:[page.ref,PDFName.of('Fit')]}));outline.set(PDFName.of('First'),item);outline.set(PDFName.of('Last'),item);outline.set(PDFName.of('Count'),pdf.context.obj(1));pdf.catalog.set(PDFName.of('Outlines'),root)}
  add(hasBookmarks?'pdf-bookmarks':'pdf-no-bookmarks','application/pdf','.pdf',await pdf.save(),'stagebpdfbodynever',hasBookmarks?'stagebpdfbookmark':null)
 }
 return files
}
export function stageBSeedSql(files){
 return `-- Synthetic acceptance only; operator must validate isolated bindings before execution.\nINSERT INTO accounts(subject,email,display_name) VALUES(${sqlString(owner)},'stageb-formats@example.invalid','Synthetic format acceptance') ON CONFLICT(subject) DO NOTHING;\n`+files.map(f=>`INSERT INTO user_books(id,owner_subject,title,author,category,object_key,mime_type,byte_length,visibility,review_status) VALUES(${[f.id,owner,f.title,f.author,f.category,f.key,f.mime].map(sqlString).join(',')},${f.bytes.length},'public','approved') ON CONFLICT(id) DO NOTHING;`).join('\n')+'\n'
}
export function assertIsolatedConfig(text){
 const ids=[...text.matchAll(/["']?database_id["']?\s*[:=]\s*["']([^"']+)["']/g)].map(m=>m[1])
 if(!ids.length||ids.some(id=>id!==ISOLATED.databaseId)||!text.includes(ISOLATED.bucket))throw Error('isolated_bindings_required')
}
export async function prepareStageBFixtures(configPath){
 assertIsolatedConfig(await readFile(configPath,'utf8'))
 const dir=resolve(fileURLToPath(new URL('../.artifacts/stageb-format-fixtures/',import.meta.url))),files=await buildStageBFormatFixtures()
 await mkdir(dir,{recursive:true})
 for(const f of files)await writeFile(resolve(dir,f.file),f.bytes,{flag:'wx'})
 await writeFile(resolve(dir,'seed.sql'),stageBSeedSql(files),{flag:'wx'})
 const ids=files.map(f=>sqlString(f.id)).join(',')
 const observation=`SELECT b.book_id,b.status,b.indexed_at,b.toc_source,b.ocr,j.state job_state,j.coverage_mode,j.source_sha256,f.pdf_kind,f.ocr_pending FROM books_index_state b JOIN public_book_index_jobs j ON j.book_id=b.book_id LEFT JOIN public_book_index_facts f ON f.book_id=b.book_id WHERE b.book_id IN (${ids});\nSELECT book_id,content_version,state,attempts,error_code FROM public_book_queue_receipts WHERE book_id IN (${ids});\nSELECT book_id,content_version,state,attempts,run_id,error_code FROM public_book_actions_dispatches WHERE book_id IN (${ids});\nSELECT book_id,field,COUNT(*) rows FROM public_book_search_rows WHERE book_id IN (${ids}) GROUP BY book_id,field;\n`
 await writeFile(resolve(dir,'observe.sql'),observation,{flag:'wx'})
 const manifest=files.map(({bytes,...f})=>({...f,byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}))
 const commands=files.map(f=>['wrangler','r2','object','put',`${ISOLATED.bucket}/${f.key}`,'--remote','--file',resolve(dir,f.file),'--config',resolve(configPath)])
 commands.push(['wrangler','d1','execute','VISITORS_DB','--remote','--file',resolve(dir,'seed.sql'),'--config',resolve(configPath)])
 commands.push(['wrangler','d1','execute','VISITORS_DB','--remote','--file',resolve(dir,'observe.sql'),'--config',resolve(configPath)])
 const plan={isolated:ISOLATED,manifest,commands,notes:['No command was executed. Upload objects before seed.','Seed is no-op for existing IDs; it does not reset completed jobs.','Let actual outbox/Queue/targeted Actions process the fixtures; do not run the legacy blanket drain.','Observe SQL proves queue/job states; public GET probes alone do not prove Queue delivery.','PDF fixtures contain synthetic non-text pages, not OCR benchmarks.']}
 await writeFile(resolve(dir,'plan.json'),JSON.stringify(plan,null,2),{flag:'wx'})
 return{directory:dir,fixtures:manifest.length}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--config')throw Error('usage_config_required');console.log(JSON.stringify(await prepareStageBFixtures(args[1])))}

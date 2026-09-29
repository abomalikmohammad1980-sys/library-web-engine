import {parentPort,workerData} from 'node:worker_threads'
import {decodeUtf8Text,textParagraphs} from '../app/src/text_import.ts'
// Import the upload gate directly: generated deployment copies must not drift
// from the validator used by the production extraction worker.
import {safeWordUpload} from '../deployment/cloudflare/functions/api/_word-upload-safety.js'
import {extractFromDocx,alignWordParagraphIndices} from '../packages/ooxml-model/dist/index.js'
import {parseBok} from '../app/src/bok_import.ts'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
const input=workerData??await new Promise(resolve=>process.once('message',resolve))
const report=value=>parentPort?parentPort.postMessage(value):process.send(value)
try{
 const {bytes,map}=input,mime=String(input.mime).split(';',1)[0].trim().toLowerCase()
 let rows,headings=[],coverageMode='text-and-headings'
 if(mime==='text/plain')rows=textParagraphs(decodeUtf8Text(bytes)).map((text,paragraphIndex)=>({text,paragraphIndex,volumeIndex:0}))
 else if(mime==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'){
  // Use the same source ceiling as the bounded executor, not a 1 MiB
  // compressed-file limit that rejects ordinary books with embedded images.
  // safeWordUpload still enforces inflated XML, archive and expansion limits.
  if(bytes.length>20*1024*1024)throw Error('word_source_bound')
  if(!await safeWordUpload(new File([bytes],'source.docx')))throw Error('unsafe_word_archive')
  const model=extractFromDocx(bytes),paragraphs=model.paragraphs
  // Exclusion flags describe layout, not missing searchable content. An empty
  // field/picture is not text and must not reject an otherwise searchable book.
  if(paragraphs.some(p=>p.excluded&&p.text?.trim()))throw Error('word_structure_unsupported')
  let aligned
  if(map!==undefined&&map!==null){
   if(!Array.isArray(map.paragraphs)||!Number.isSafeInteger(map.totalPages)||map.totalPages<1||map.paragraphs.length!==map.paragraphCount)throw Error('invalid_word_map')
   const ids=new Set()
   for(const p of map.paragraphs){if(!p||typeof p.text!=='string'||!Number.isSafeInteger(p.paragraphIndex)||p.paragraphIndex<0||ids.has(p.paragraphIndex)||!Number.isSafeInteger(p.physicalPage)||p.physicalPage<1||p.physicalPage>map.totalPages)throw Error('invalid_word_map');ids.add(p.paragraphIndex)}
   aligned=alignWordParagraphIndices(model,map)
   if(!aligned)throw Error('word_map_source_mismatch')
  }
  // Browser imports have no authoritative page map; their valid paragraph
  // anchors remain searchable without fabricating a physical page number.
  rows=paragraphs.flatMap((p,index)=>p.text?.trim()?[{text:p.text,paragraphIndex:p.index,volumeIndex:0,...(aligned?{pageIndex:map.paragraphs[aligned[index]].physicalPage-1}:{})}]:[])
  headings=paragraphs.flatMap(p=>p.toc?.entry?.trim()?[{value:p.toc.entry,paragraphIndex:p.index}]:[])
  if(!headings.length)headings=paragraphs.flatMap(p=>p.outlineLevel>=0&&p.outlineLevel<=8&&p.outlineLevel!=null&&p.text.trim()?[{value:p.text,paragraphIndex:p.index}]:[])
 }else if(mime==='text/markdown'){
  let jsdom
  try{jsdom=createRequire(new URL('../package.json',import.meta.url))('jsdom')}
  catch{try{jsdom=createRequire(new URL('./public-book-index-runtime/package.json',import.meta.url))('jsdom')}catch{try{jsdom=createRequire(new URL('../.artifacts/ingestion-runtime/package.json',import.meta.url))('jsdom')}catch{throw Error('markdown_dom_runtime_required')}}}
  // No resources or runScripts option: imported HTML cannot fetch or execute.
  const dom=new jsdom.JSDOM('',{url:'https://isolated.invalid/'})
  try{
   globalThis.window=dom.window;globalThis.document=dom.window.document
   const {renderMarkdownPages}=await import('../app/src/markdown_render.ts')
   const rendered=renderMarkdownPages(decodeUtf8Text(bytes))
   try{
    const {renderedSearchText}=await import('./public-book-rendered-text.mjs')
    rows=rendered.pages.map((page,pageIndex)=>{page.querySelector('.reader__text-folio')?.remove();return {text:renderedSearchText(page),pageIndex,volumeIndex:0}}).filter(row=>row.text.trim())
    headings=rendered.toc.map(t=>({value:t.title,pageIndex:t.page-1,bookmark:t.bookmark}))
   }finally{for(const url of rendered.assetUrls)URL.revokeObjectURL(url)}
  }finally{dom.window.close()}
 }else if(mime==='application/epub+zip'){
  const {extractPublicEpub}=await import('./public-book-index-epub.mjs')
  ;({rows,headings,coverageMode}=extractPublicEpub(bytes))
 }else if(mime==='application/pdf'){
  const {extractPublicPdfBookmarks}=await import('./public-book-index-pdf.mjs')
  const result=await extractPublicPdfBookmarks(new Uint8Array(bytes))
  if(parentPort)parentPort.postMessage({result})
  else await new Promise((resolve,reject)=>process.send({result},error=>error?reject(error):resolve()))
  process.exit(0)
 }else if(['application/octet-stream','application/x-bok','application/x-shamela-bok'].includes(mime)){
  const parsed=parseBok(bytes,'source.bok')
  rows=parsed.pages.map((p,pageIndex)=>({text:p.text,pageIndex,pageId:p.id,pageLabel:String(p.page),partLabel:String(p.part),volumeIndex:0}))
  const pages=new Map(rows.map(p=>[p.pageId,p]))
  headings=parsed.toc.map(t=>{const p=pages.get(t.id);return {value:t.title,...(p?{pageIndex:p.pageIndex,pageLabel:p.pageLabel,partLabel:p.partLabel}:{})}})
 }else throw Error('unsupported_source_format')
 if(rows.length>100000||headings.length>100000)throw Error('extraction_row_bound')
 const result={rows,headings,coverageMode}
 if(Buffer.byteLength(JSON.stringify(result))>16*1024*1024)throw Error('extraction_output_bound')
 report({result})
}catch(error){report({error:/^[a-z][a-z0-9_]{0,79}$/.test(error.message)?error.message:'source_parse_failed'})}

import {parentPort,workerData} from 'node:worker_threads'
import {decodeUtf8Text,textParagraphs} from '../app/src/text_import.ts'
import {safeWordUpload} from '../alpha-publish/functions/api/_word-upload-safety.js'
import {extractFromDocx} from '../packages/ooxml-model/dist/index.js'
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
  if(!map)throw Error('word_map_required')
  if(!await safeWordUpload(new File([bytes],'source.docx')))throw Error('unsafe_word_archive')
  const paragraphs=extractFromDocx(bytes).paragraphs
  // This first adapter refuses structures the existing model explicitly excludes.
  // Skipping tables/fields would falsely declare complete body coverage.
  if(paragraphs.some(p=>p.excluded&&p.excluded!=='empty'))throw Error('word_structure_unsupported')
  if(!Array.isArray(map.paragraphs)||!Number.isSafeInteger(map.totalPages)||map.totalPages<1||map.paragraphs.length!==map.paragraphCount)throw Error('invalid_word_map')
  // Index once: long Word books must not scan the entire map per paragraph.
  // Duplicate IDs are ambiguous anchors, even when their text happens to match.
  const paragraphMap=new Map()
  for(const entry of map.paragraphs){
   if(!entry||!Number.isSafeInteger(entry.paragraphIndex)||entry.paragraphIndex<0||paragraphMap.has(entry.paragraphIndex))throw Error('invalid_word_map')
   paragraphMap.set(entry.paragraphIndex,entry)
  }
  const seen=new Set()
  rows=paragraphs.filter(p=>p.text?.trim()).map(p=>{
   const mapped=paragraphMap.get(p.index)
   if(!mapped||mapped.text!==p.text||!Number.isSafeInteger(mapped.physicalPage)||mapped.physicalPage<1||mapped.physicalPage>map.totalPages)throw Error('word_map_source_mismatch')
   seen.add(mapped.paragraphIndex)
   return {text:p.text,paragraphIndex:p.index,pageIndex:mapped.physicalPage-1,volumeIndex:0}
  })
  if(map.paragraphs.some(p=>p.text?.trim()&&!seen.has(p.paragraphIndex)))throw Error('word_map_source_mismatch')
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

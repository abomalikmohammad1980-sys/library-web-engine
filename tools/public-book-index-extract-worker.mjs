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
  if(bytes.length>1024*1024)throw Error('word_source_bound')
  if(!map)throw Error('word_map_required')
  if(!await safeWordUpload(new File([bytes],'source.docx')))throw Error('unsafe_word_archive')
  const paragraphs=extractFromDocx(bytes).paragraphs
  // This first adapter refuses structures the existing model explicitly excludes.
  // Skipping tables/fields would falsely declare complete body coverage.
  if(paragraphs.some(p=>p.excluded&&p.excluded!=='empty'))throw Error('word_structure_unsupported')
  if(!Array.isArray(map.paragraphs)||!Number.isSafeInteger(map.totalPages)||map.totalPages<1||map.paragraphs.length!==map.paragraphCount)throw Error('invalid_word_map')
  const seen=new Set()
  rows=paragraphs.filter(p=>p.text?.trim()).map(p=>{
   const mapped=map.paragraphs.find(m=>m.paragraphIndex===p.index)
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
    rows=rendered.pages.map((page,pageIndex)=>{page.querySelector('.reader__text-folio')?.remove();return {text:page.textContent??'',pageIndex,volumeIndex:0}}).filter(row=>row.text.trim())
    headings=rendered.toc.map(t=>({value:t.title,pageIndex:t.page-1,bookmark:t.bookmark}))
   }finally{for(const url of rendered.assetUrls)URL.revokeObjectURL(url)}
  }finally{dom.window.close()}
 }else if(mime==='application/pdf'){
  const require=createRequire(new URL('../app/package.json',import.meta.url))
  const pdfjs=await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href)
  const task=pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:false,disableFontFace:true,stopAtErrors:true})
  try{
   const pdf=await task.promise
   if(pdf.numPages>100000)throw Error('pdf_page_bound')
   const stack=(await pdf.getOutline()??[]).map(item=>({item,depth:0})).reverse();let visited=0
   while(stack.length){
    const {item,depth}=stack.pop()
    if(++visited>100000||depth>128)throw Error('pdf_outline_bound')
    const destination=typeof item.dest==='string'?await pdf.getDestination(item.dest):item.dest
    if(item.title?.trim()&&Array.isArray(destination)&&destination.length){
     const ref=destination[0],pageIndex=typeof ref==='number'?ref:await pdf.getPageIndex(ref)
     if(Number.isInteger(pageIndex)&&pageIndex>=0&&pageIndex<pdf.numPages)headings.push({value:item.title.trim(),pageIndex})
    }
    for(let i=(item.items?.length??0)-1;i>=0;i--)stack.push({item:item.items[i],depth:depth+1})
   }
   // Deliberately no getPage/getTextContent/OCR: only the same bookmarks and
   // destination semantics as the application's pdfHeadingIndex.
   rows=[];coverageMode='pdf-bookmarks-only'
  }finally{await task.destroy()}
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

import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'

export const PDF_CLASSIFICATION_CONTRACT='pdf-source-classification/1'
const MAX_OUTPUT=16*1024*1024

/** All pages are inspected; an interrupted/oversized extraction never becomes ready.
 * Called only inside the existing bounded extraction executor, not a Pages request. */
export async function extractPdfDocumentBookmarks(pdf,{sourceSha256,parserVersion}={}){
 if(!/^[a-f0-9]{64}$/.test(sourceSha256??'')||typeof parserVersion!=='string'||!parserVersion.length)throw Error('pdf_provenance_required')
 if(!Number.isSafeInteger(pdf.numPages)||pdf.numPages<1||pdf.numPages>100000)throw Error('pdf_page_bound')
 const headings=[],stack=(await pdf.getOutline()??[]).map(item=>({item,depth:0})).reverse()
 let visited=0,outputBytes=0,lowTextPages=0
 const reserve=value=>{outputBytes+=Buffer.byteLength(JSON.stringify(value));if(outputBytes>MAX_OUTPUT)throw Error('extraction_output_bound')}
 while(stack.length){
  const {item,depth}=stack.pop()
  if(++visited>100000||depth>128)throw Error('pdf_outline_bound')
  const destination=typeof item.dest==='string'?await pdf.getDestination(item.dest):item.dest
  if(item.title?.trim()&&Array.isArray(destination)&&destination.length){
   const ref=destination[0],pageIndex=typeof ref==='number'?ref:await pdf.getPageIndex(ref)
   if(!Number.isSafeInteger(pageIndex)||pageIndex<0||pageIndex>=pdf.numPages)throw Error('pdf_outline_destination_invalid')
   const heading={value:item.title.trim(),pageIndex};reserve(heading);headings.push(heading)
  }
  for(let i=(item.items?.length??0)-1;i>=0;i--)stack.push({item:item.items[i],depth:depth+1})
 }
 for(let pageIndex=0;pageIndex<pdf.numPages;pageIndex++){
  const page=await pdf.getPage(pageIndex+1)
  try{
   const content=await page.getTextContent()
   // PDF.js supplies logical text strings; do not reverse Arabic glyphs or rewrite it.
   const text=content.items.filter(item=>typeof item.str==='string').map(item=>item.str+(item.hasEOL?'\n':' ')).join('').trim()
   if(Array.from(text.replace(/\s/gu,'')).length<20)lowTextPages++
  }finally{page.cleanup?.()}
 }
 const ocrRequired=lowTextPages*5>=pdf.numPages*4
 const result={coverageMode:'pdf-bookmarks-only',rows:[],headings,pdfClassification:{contract:PDF_CLASSIFICATION_CONTRACT,sourceSha256,parserVersion,pageCount:pdf.numPages,lowTextPages,kind:ocrRequired?'scanned':'text',ocrPending:ocrRequired}}
 if(Buffer.byteLength(JSON.stringify(result))>MAX_OUTPUT)throw Error('extraction_output_bound')
 return result
}

export async function extractPublicPdfBookmarks(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength>64*1024*1024)throw Error('pdf_source_bound')
 const sourceSha256=createHash('sha256').update(bytes).digest('hex')
 const require=createRequire(new URL('../app/package.json',import.meta.url))
 const pdfjs=await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href)
 const task=pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:false,disableFontFace:true,stopAtErrors:true})
 try{return await extractPdfDocumentBookmarks(await task.promise,{sourceSha256,parserVersion:`pdfjs-${pdfjs.version}/pdf-classifier-v1`})}
 finally{await task.destroy()}
}

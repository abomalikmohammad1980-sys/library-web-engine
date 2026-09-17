import {pdfJsLocalAssets} from './pdfjs_assets'
import type {HeadingIndex,HeadingEntry} from './engine/heading_index'

/** PDF search reads bookmarks only: never page text or OCR. */
export async function pdfHeadingIndex(data:Uint8Array):Promise<HeadingIndex>{
 const pdfjs=await import('pdfjs-dist')
 const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
 pdfjs.GlobalWorkerOptions.workerSrc=worker.default
 const task=pdfjs.getDocument({data:new Uint8Array(data),...pdfJsLocalAssets()})
 try{
  const pdf=await task.promise,entries:HeadingEntry[]=[]
  type Outline=NonNullable<Awaited<ReturnType<typeof pdf.getOutline>>>
  const visit=async(items:Outline):Promise<void>=>{
   for(const item of items){
    const destination=typeof item.dest==='string'?await pdf.getDestination(item.dest):item.dest
    if(item.title?.trim()&&Array.isArray(destination)&&destination.length){
     const ref=destination[0],pageIndex=typeof ref==='number'?ref:await pdf.getPageIndex(ref)
     if(Number.isInteger(pageIndex)&&pageIndex>=0&&pageIndex<pdf.numPages)entries.push({value:item.title.trim(),pageIndex})
    }
    if(item.items?.length)await visit(item.items)
   }
  }
  await visit(await pdf.getOutline()??[])
  return {complete:true,entries}
 }finally{await task.destroy()}
}

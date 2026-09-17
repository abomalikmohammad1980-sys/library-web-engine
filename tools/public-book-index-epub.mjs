import {parseEpub} from '../app/src/epub_import.ts'
import {createRequire} from 'node:module'
const {unzipSync}=createRequire(new URL('../app/package.json',import.meta.url))('fflate')

/** Shared reader parser, with native EPUB2 NCX / EPUB3 navigation only.
 * Reader EPUB pages are chapters, so pageIndex is the real chapter position. */
export function extractPublicEpub(bytes){
 let expanded=0,count=0
 const files=unzipSync(bytes,{filter(entry){if(++count>10000||(expanded+=entry.originalSize)>32*1024*1024)throw Error('epub_archive_bound');return true}})
 const parsed=parseEpub(bytes,'source.epub')
 const rows=parsed.chapters.map((chapter,pageIndex)=>({text:chapter.text,pageIndex,volumeIndex:0}))
 let headings=parsed.toc.map(entry=>({value:entry.title,pageIndex:entry.chapterIndex,volumeIndex:0}))
 const decoder=new TextDecoder('utf-8',{fatal:true})
 const container=decoder.decode(files['META-INF/container.xml'])
 const opfPath=/full-path\s*=\s*["']([^"']+)["']/.exec(container)?.[1]
 if(!opfPath)throw Error('epub_container_invalid')
 const opf=decoder.decode(files[opfPath])
 const navTag=(opf.match(/<item\b[^>]*>/gi)??[]).find(tag=>/properties\s*=\s*["'][^"']*\bnav\b/.test(tag))
 if(navTag){
  const href=/href\s*=\s*["']([^"']+)["']/.exec(navTag)?.[1]
  const resolve=(base,link)=>{const url=new URL(link,'https://epub.invalid/'+base);if(url.origin!=='https://epub.invalid'||url.search)throw Error('epub_external_navigation');const path=decodeURIComponent(url.pathname.slice(1));if(path.includes('\\')||path.includes('%'))throw Error('epub_navigation_path');return path}
  const navPath=resolve(opfPath,href??'')
  if(!files[navPath])throw Error('epub_navigation_missing')
  let JSDOM
  for(const runtime of ['./public-book-index-runtime/package.json','../package.json','../.artifacts/ingestion-runtime/package.json']){try{({JSDOM}=createRequire(new URL(runtime,import.meta.url))('jsdom'));break}catch{}}
  if(!JSDOM)throw Error('epub_dom_runtime_required')
  const dom=new JSDOM(decoder.decode(files[navPath])) // no scripts/resources enabled
  try{
   const nav=[...dom.window.document.querySelectorAll('nav')].find(node=>(node.getAttribute('epub:type')??'').split(/\s+/).includes('toc')||node.getAttribute('role')==='doc-toc')
   if(!nav)throw Error('epub_navigation_toc_missing')
   nav.querySelectorAll('script,style').forEach(node=>node.remove())
   headings=[...nav.querySelectorAll('a[href]')].map(anchor=>{
    const path=resolve(navPath,anchor.getAttribute('href')),pageIndex=parsed.chapters.findIndex(chapter=>chapter.path===path)
    if(pageIndex<0)throw Error('epub_navigation_target_missing')
    return{value:anchor.textContent.trim(),pageIndex,volumeIndex:0}
   }).filter(entry=>entry.value)
  }finally{dom.window.close()}
 }
 if(rows.length>100000||headings.length>100000)throw Error('extraction_row_bound')
 return {rows,headings,coverageMode:'text-and-headings'}
}

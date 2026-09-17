import {readVerifiedPublicBookIndex} from './api/_public-book-index-read.js'
import {plainSeoText} from '../../app/src/page_meta_model.ts'
const integer=value=>Number.isSafeInteger(value)&&value>=0
/** Only ready, currently eligible generations are consumed. No caller-supplied
 * object key, source text, private identity or body row is returned. */
export async function readPublicSeoToc(env,bookId){
 const artifact=await readVerifiedPublicBookIndex(env,bookId)
 if(!artifact)return null
 const rows=artifact.headings.map(heading=>{
  if(!heading||typeof heading.value!=='string'||heading.value.length>1000000)throw Error('seo_public_toc_heading')
  const title=plainSeoText(heading.value),params=new URLSearchParams()
  // These are the actual reader query fields. Never guess a page from an ID.
  if(artifact.coverageMode==='pdf-bookmarks-only'){
   if(integer(heading.pageIndex))params.set('pageIndex',String(heading.pageIndex))
  }else if(integer(heading.paragraphIndex))params.set('para',String(heading.paragraphIndex))
  else if(integer(heading.pageIndex))params.set('pageIndex',String(heading.pageIndex))
  if(params.size&&integer(heading.volumeIndex))params.set('volumeIndex',String(heading.volumeIndex))
  return{title,href:params.size?`/books/public/${encodeURIComponent(bookId)}?${params}`:null}
 }).filter(row=>row.title)
 return{rows,generation:artifact.generation,coverageMode:artifact.coverageMode}
}

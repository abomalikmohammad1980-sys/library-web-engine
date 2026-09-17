import {SEO_ORIGIN,type PageMeta} from './page_meta_model'
import {pageMetaFor,loadedReaderPageMeta,type PublicSeoRecord} from './page_meta_model'
/** Replace, rather than accumulate, metadata on SPA navigation. */
export function setPageMeta({title,description,canonicalPath,robots='index, follow'}:PageMeta):void{
 document.title=title
 const put=(name:string,value:string)=>{
  const all=[...document.head.querySelectorAll<HTMLMetaElement>(`meta[name="${name}"]`)],el=all.shift()??document.createElement('meta')
  all.forEach(node=>node.remove());el.name=name;el.content=value;if(!el.isConnected)document.head.append(el)
 }
 put('description',description);put('robots',robots)
 document.head.querySelectorAll('link[rel="canonical"]').forEach(node=>node.remove())
 if(canonicalPath&&!robots.includes('noindex')){
  if(!canonicalPath.startsWith('/')||canonicalPath.startsWith('//'))throw Error('canonical_path_invalid')
  const url=new URL(canonicalPath,SEO_ORIGIN);url.search='';url.hash=''
  const link=document.createElement('link');link.rel='canonical';link.href=url.href;document.head.append(link)
 }
}
/** One route-owned load; late responses cannot overwrite a later screen. */
export function bindPageMeta(content:HTMLElement,isCurrent:()=>boolean):()=>void{
 const controller=new AbortController(),path=location.pathname+location.search
 let meta=pageMetaFor(path),last='',hasRemoteRecord=false
 const apply=()=>{if(isCurrent()&&!controller.signal.aborted){
  const reader=content.matches('[data-reader-title]')?content:content.querySelector<HTMLElement>('[data-reader-title]')
  const resolved=hasRemoteRecord?meta:loadedReaderPageMeta(path,reader?.dataset.readerTitle??'',reader?.dataset.readerAuthor??'')??meta
  const key=JSON.stringify(resolved);if(key!==last||document.title!==resolved.title){setPageMeta(resolved);last=key}
 }}
 apply()
 const match=/^\/(authors|books)\/(\d{1,12})$/.exec(location.pathname)??/^\/(books)\/public\/([A-Za-z0-9_-]{1,200})$/.exec(location.pathname)
 if(match){const id=match[1]==='authors'?match[2]!.padStart(6,'0'):match[2]!;void fetch(`/api/seo/record?kind=${match[1]}&id=${id}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{
  if(!response.ok)throw Error('seo_meta_unavailable');const data=await response.json() as {record?:PublicSeoRecord};if(data.record){meta=pageMetaFor(path,data.record);hasRemoteRecord=true}apply()
 }).catch(()=>{if(!controller.signal.aborted)apply()})}
 // Screen title setters also run after local/cloud data resolves. Restore the
 // unified route contract once that DOM update is complete, without observing head.
 const observer=new MutationObserver(apply);observer.observe(content,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-reader-title','data-reader-author']})
 return()=>{controller.abort();observer.disconnect()}
}

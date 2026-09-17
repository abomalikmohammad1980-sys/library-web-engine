import {setSourceDocumentTitle} from './translation'
/** Only the route's identity heading is eligible; never pick a result/card heading. */
export const DYNAMIC_TITLE_SELECTORS:Readonly<Record<string,string>>={
 people:'#person-title, .author-hero h1',
 author:'.author-hero h1',
 authors:'.people-facet__header h2, .people-facet__title-row h2',
 'sunnah-source':'#sunnah-source-title',
 quran:'.quran-surah-title',
 'quran-tafsir':'.quran-tafsir-book h1',
}
/** These screens own their resolved title directly (book routes resolve to reader). */
export const SCREEN_OWNED_TITLE_ROUTES=['reader','book','search'] as const
/** Collection and utility pages have no single selected book/person identity. */
export const COLLECTION_TITLE_ROUTES=['recommendations','not-found','home','quotes','new-books','features','sunnah','welcome','browse','shelves','reading-plans','research-projects','editions','series','data-quality','me','settings','notes','library','admin-books','sign-in'] as const
export function bindResolvedRouteTitle(route:string,content:HTMLElement,isCurrent:()=>boolean):()=>void{
 const selector=DYNAMIC_TITLE_SELECTORS[route];if(!selector)return()=>{}
 let last='',disposed=false,pending=false
 const update=()=>{
  pending=false;if(disposed||!isCurrent()||!content.isConnected)return
  const name=content.querySelector(selector)?.textContent?.replace(/\s+/g,' ').trim()
  if(!name||name===last)return
  last=name;setSourceDocumentTitle(`${name} — الخِزانة`)
 }
 const observer=new MutationObserver(()=>{if(!pending){pending=true;queueMicrotask(update)}})
 observer.observe(content,{subtree:true,childList:true,characterData:true});update()
 return()=>{disposed=true;observer.disconnect()}
}

import data from './quran_source_heading_links.generated.json'
import definitions from './quran_source_editions.generated.json'
export interface NumberedHeadingBookLink {bookId:string;pageIndex:number;sourceRowId:string;href:string;method:'explicit-local-numbered-verse-heading'|'explicit-local-quran-opening';sharedRange?:{surah:number;from:number;to:number}}
export function getNumberedHeadingBookLink(slug:string,surah:number,ayah:number):NumberedHeadingBookLink|undefined{
 if(!Number.isInteger(surah)||!Number.isInteger(ayah))return
 const editions=data.editions as Record<string,{bookId:string;manifestSha256:string;method:string;anchors:Array<{surah:number;ayah:number;pageIndex:number;sourceRowId:string;from?:number;to?:number}>}>
 if(!Object.hasOwn(editions,slug))return
 const edition=editions[slug],definition=definitions.find(d=>d.slug===slug)
 if(!edition||!definition||definition.manifestSha256!==edition.manifestSha256)return
 const anchor=edition.anchors.find(a=>a.surah===surah&&a.ayah===ayah)
 if(!anchor||!Number.isInteger(anchor.pageIndex)||anchor.pageIndex<0)return
 const method=edition.method==='unique-canonical-opening-full-quote'?'explicit-local-quran-opening':edition.method==='unique-canonical-numbered-page-heading'?'explicit-local-numbered-verse-heading':undefined
 if(!method)return
 return {bookId:edition.bookId,pageIndex:anchor.pageIndex,sourceRowId:anchor.sourceRowId,href:`#/reader/${edition.bookId}?pageIndex=${anchor.pageIndex}`,method,...(anchor.from&&anchor.to&&anchor.from<anchor.to?{sharedRange:{surah,from:anchor.from,to:anchor.to}}:{})}
}

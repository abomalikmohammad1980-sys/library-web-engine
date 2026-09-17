import definitions from './quran_source_editions.generated.json'
import type {ReviewedOriginalBookLink} from './quran_source_reviewed_links'

/** Independently reviewed original commentary bounded by canonical verses 44:47 and 44:49.
 * Evidence: tafsir-resume-independent-review-20260914.json; no source text is replaced.
 */
export function kashshafBoundedLink(defs:readonly {slug:string;manifestSha256:string}[],slug:string,surah:number,ayah:number):ReviewedOriginalBookLink|undefined {
 if(slug!=='kashshaf'||surah!==44||ayah!==48||defs.find(d=>d.slug===slug)?.manifestSha256!=='5cdcd62ccb3f95ce7485958d70846f5c28c193c1d8722e6adf910eec06ebd766')return
 return {bookId:'410023627',pageIndex:2345,sourceRowId:'2346',href:'#/reader/410023627?pageIndex=2345',method:'reviewed-original-verse-section',destinationNote:'موضع تفسير الآية مثبت بنص المفسر بين الآيتين السابقتين واللاحقتين في الأصل'}
}
export const getKashshafBoundedLink=(slug:string,surah:number,ayah:number)=>kashshafBoundedLink(definitions,slug,surah,ayah)

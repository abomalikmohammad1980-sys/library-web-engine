import review from './quran_reviewed_excerpts.generated.json'
import definitions from './quran_source_editions.generated.json'
import type {ReviewedOriginalBookLink} from './quran_source_reviewed_links'
interface Definition {slug:string;manifestSha256:string;files:readonly {surah:number;checksumSha256:string}[]}
function anchor(definition:Definition,surah:number,ayah:number){
 if(review.schemaVersion!==1)return
 const matches=review.records.filter(r=>r.slug===definition.slug&&r.surah===surah&&r.ayah===ayah)
 if(matches.length!==1)return
 const r=matches[0]!
 if(r.manifestSha256!==definition.manifestSha256||r.fileSha256!==definition.files.find(f=>f.surah===surah)?.checksumSha256||!Number.isInteger(r.from)||!Number.isInteger(r.to)||r.from<0||r.from>=r.to||r.to>r.originalHtml.length)return
 return r
}
/** Exact reviewed source record only. Never infer an excerpt from nearby headings or prose. */
export function reviewedTafsirExcerpt(definition:Definition,surah:number,ayah:number,html:string):string|undefined{
 const r=anchor(definition,surah,ayah)
 // Comparing the entire source string is stricter than applying offsets to a matching prefix.
 if(!r||html!==r.originalHtml)return
 return html.slice(r.from,r.to)
}
export function getReviewedExcerptBookLink(slug:string,surah:number,ayah:number):ReviewedOriginalBookLink|undefined{
 const definition=definitions.find(d=>d.slug===slug);if(!definition)return
 const r=anchor(definition,surah,ayah);if(!r)return
 return {bookId:r.bookId,pageIndex:r.pageIndex,sourceRowId:r.sourceRowId,href:`#/reader/${r.bookId}?pageIndex=${r.pageIndex}`,method:'reviewed-original-verse-section',destinationNote:'موضع تفسير الآية ومقتطفها مثبتان بالمراجعة النصية للأصل'}
}

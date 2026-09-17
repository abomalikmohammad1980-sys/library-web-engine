import data from './quran_mathoor_reviewed_links.generated.json'
import definitions from './quran_source_editions.generated.json'
import type {ReviewedOriginalBookLink} from './quran_source_reviewed_links'
interface Anchor {surah:number;ayah:number;pageIndex:number;sourceRowId:string;from:number;to:number;sourceTextSha256:string;evidenceKind:string;destinationNote:string}
interface Reviewed {schemaVersion:number;sourceManifestSha256:string;bookId:string;originalBookSha256:string;anchors:readonly Anchor[]}
const manifest='6e50b6439b692d4f5e03f2ee43cb79a1d2a41e64f69656f87b49fa7a72b1b04a',bookSha='a43d2661ac8bd1106af3ecbe0f94b3eaecf65df16888bf8b5a8f52abb8cad360'
const kinds=new Set(['unique-original-numbered-report-and-source-verse-heading','explicit-source-group-to-verified-original-verse','explicit-source-reference-to-verified-group'])
/** Inert until this exact source revision is activated; all destinations are original book 639. */
export function mathoorReviewedLink(review:Reviewed,defs:readonly {slug:string;bookId:number;manifestSha256:string}[],slug:string,surah:number,ayah:number):ReviewedOriginalBookLink|undefined {
 if(slug!=='shuoun-mathoor'||!Number.isInteger(surah)||!Number.isInteger(ayah)||surah<1||surah>114||ayah<1||ayah>286)return
 const definition=defs.find(d=>d.slug===slug)
 if(definition?.bookId!==639||definition.manifestSha256!==manifest||review.sourceManifestSha256!==manifest||review.bookId!=='410000639'||review.originalBookSha256!==bookSha||review.schemaVersion!==1)return
 const matches=review.anchors.filter(a=>a.surah===surah&&a.ayah===ayah);if(matches.length!==1)return
 const a=matches[0]!
 if(![a.pageIndex,a.from,a.to].every(Number.isInteger)||a.pageIndex<0||a.from<1||a.from>ayah||a.to<ayah||a.to>286||!a.sourceRowId||!/^[a-f0-9]{64}$/.test(a.sourceTextSha256)||!kinds.has(a.evidenceKind)||!a.destinationNote)return
 return {bookId:review.bookId,pageIndex:a.pageIndex,sourceRowId:a.sourceRowId,href:`#/reader/${review.bookId}?pageIndex=${a.pageIndex}`,method:'reviewed-original-verse-section',destinationNote:a.destinationNote,...(a.from<a.to?{sharedRange:{surah,from:a.from,to:a.to}}:{})}
}
export const getMathoorReviewedLink=(slug:string,surah:number,ayah:number)=>mathoorReviewedLink(data,definitions,slug,surah,ayah)

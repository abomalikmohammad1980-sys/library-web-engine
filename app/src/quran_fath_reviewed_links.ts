import data from './quran_fath_reviewed_links.generated.json'
import definitions from './quran_source_editions.generated.json'
import type {ReviewedOriginalBookLink} from './quran_source_reviewed_links'
interface Anchor {surah:number;ayah:number;from:number;to:number;pageIndex:number;sourceRowId:string;titleId:string;bodySha256:string;sourceTextSha256:string;sectionSha256:string;evidenceSha256:string;destinationNote:string}
interface Review {schemaVersion:number;sourceManifestSha256:string;bookSha256:string;anchors:readonly Anchor[]}
const manifest='5a8c794c0a8f55a7db95a21a5f20e2750c62b3d9ef1f7f80c2bc05b251c60354',book='e7c3342ea007fbc94da22eaeb358e5c13944ef25cba4273203cb402d983e92cd'
const accepted:Readonly<Record<string,readonly number[]>>={'35':[2,17,18,49],'37':[2,21,22,54],'38':[2,23,24,57],'233':[4,153,159,609]}
/** Four reviewed original titles only: no generic reversal of invalid ranges. */
export function fathReviewedLink(review:Review,defs:readonly {slug:string;bookId:number;manifestSha256:string}[],slug:string,surah:number,ayah:number):ReviewedOriginalBookLink|undefined{
 if(slug!=='fath-al-qadir'||!Number.isInteger(surah)||!Number.isInteger(ayah))return
 const d=defs.find(d=>d.slug===slug);if(d?.bookId!==343||d.manifestSha256!==manifest||review.sourceManifestSha256!==manifest||review.bookSha256!==book||review.schemaVersion!==1)return
 const rows=review.anchors.filter(a=>a.surah===surah&&a.ayah===ayah);if(rows.length!==1)return
 const a=rows[0]!,bounds=Object.hasOwn(accepted,a.titleId)?accepted[a.titleId]:undefined
 if(!bounds||[a.surah,a.from,a.to,a.pageIndex].some((v,i)=>v!==bounds[i])||ayah<a.from||ayah>a.to||a.sourceRowId!==String(a.pageIndex+1)||!a.destinationNote||![a.bodySha256,a.sourceTextSha256,a.sectionSha256,a.evidenceSha256].every(h=>/^[a-f0-9]{64}$/.test(h)))return
 return{bookId:'410023623',pageIndex:a.pageIndex,sourceRowId:a.sourceRowId,href:`#/reader/410023623?pageIndex=${a.pageIndex}`,method:'reviewed-original-verse-section',sharedRange:{surah,from:a.from,to:a.to},destinationNote:a.destinationNote}
}
export const getFathReviewedLink=(slug:string,surah:number,ayah:number)=>fathReviewedLink(data,definitions,slug,surah,ayah)

import data from './quran_uthaymin_reviewed_links.generated.json'
import definitions from './quran_source_editions.generated.json'
import type {ReviewedOriginalBookLink} from './quran_source_reviewed_links'
interface Anchor {surah:number;ayah:number;bookId:string;bookSha256:string;pageIndex:number;sourceRowId:string;bodySha256:string;sourceTextSha256:string;fromPage:number;toPageExclusive:number;evidenceKind:string;commentaryWitnessChars:number;destinationNote:string;nextBodySha256?:string;openingGroup?:{from:number;to:number;pageIndex:number;bodySha256:string}}
interface ReviewedData {schemaVersion:number;sourceManifestSha256:string;evidencePolicy:string;anchors:readonly Anchor[]}
interface Anchor {adjacentVerses?:{previous:number;next:number}}
interface Anchor {interleavedCrossPage?:boolean}
const manifest='d1d44b5e2cd082c4b3fbfbe8de3e6404307a0c5f15f71fc52b8de8e96cf8d5e0'
const books:Readonly<Record<string,{sha256:string;fromSurah:number;toSurah:number}>>={
 '410151166':{sha256:'3ba792978d70473ab87d61bb2cb833a9fc5896e259d28b9e60b0abcbb8ec4b6a',fromSurah:49,toSurah:57},
 '410151168':{sha256:'ed78419688ec2a014bb0154b4ed840809362941acec793c40a93ea6f90a9389f',fromSurah:78,toSurah:114},
}
/** Exact key and reviewed original-book edition only; never infer a nearby page. */
export function uthayminReviewedBookLink(review:ReviewedData,sourceDefinitions:readonly {slug:string;bookId:number;manifestSha256:string}[],slug:string,surah:number,ayah:number):ReviewedOriginalBookLink|undefined {
 if(slug!=='ibn-uthaymin'||!Number.isInteger(surah)||!Number.isInteger(ayah)||surah<1||surah>114||ayah<1||ayah>286)return
 const definition=sourceDefinitions.find(d=>d.slug===slug)
 if(definition?.bookId!==27804||definition.manifestSha256!==manifest||review.sourceManifestSha256!==manifest||review.schemaVersion!==1||review.evidencePolicy!=='uthaymin-unique-verse-commentary-and-surah-witnesses/1')return
 const matches=review.anchors.filter(a=>a.surah===surah&&a.ayah===ayah);if(matches.length!==1)return
 const a=matches[0]!,book=Object.hasOwn(books,a.bookId)?books[a.bookId]:undefined
 if(!book||book.sha256!==a.bookSha256||surah<book.fromSurah||surah>book.toSurah||!Number.isInteger(a.commentaryWitnessChars)||a.commentaryWitnessChars<60||a.commentaryWitnessChars>80)return
 if(a.evidenceKind==='unique-complete-verse-commentary-and-exact-opening-group'){
  const g=a.openingGroup
  if(!g||g.from!==1||!Number.isInteger(g.to)||g.to<2||g.to>286||g.pageIndex!==a.fromPage||!/^[a-f0-9]{64}$/.test(g.bodySha256))return
 }else if(a.evidenceKind==='unique-complete-verse-commentary-cross-page-in-verified-surah'||a.evidenceKind==='repeated-verse-unique-commentary-between-adjacent-verses'){
  if(a.evidenceKind==='repeated-verse-unique-commentary-between-adjacent-verses'&&(!a.adjacentVerses||a.adjacentVerses.previous!==ayah-1||a.adjacentVerses.next!==ayah+1))return
  if(!a.nextBodySha256||!/^[a-f0-9]{64}$/.test(a.nextBodySha256)||a.pageIndex+1>=a.toPageExclusive)return
 }else if(a.evidenceKind==='unique-complete-verse-interleaved-commentary-in-verified-surah'){
  if(typeof a.interleavedCrossPage!=='boolean'||a.interleavedCrossPage!==Boolean(a.nextBodySha256))return
  if(a.commentaryWitnessChars!==80||(a.nextBodySha256&&(!/^[a-f0-9]{64}$/.test(a.nextBodySha256)||a.pageIndex+1>=a.toPageExclusive)))return
 }else if(a.evidenceKind!=='unique-complete-verse-and-contiguous-commentary-in-verified-surah')return
 if(![a.pageIndex,a.fromPage,a.toPageExclusive].every(Number.isInteger)||a.fromPage<0||a.pageIndex<a.fromPage||a.pageIndex>=a.toPageExclusive||typeof a.sourceRowId!=='string'||!a.sourceRowId||![a.bodySha256,a.sourceTextSha256].every(s=>/^[a-f0-9]{64}$/.test(s))||!a.destinationNote)return
 return {bookId:a.bookId,pageIndex:a.pageIndex,sourceRowId:a.sourceRowId,href:`#/reader/${a.bookId}?pageIndex=${a.pageIndex}`,method:'reviewed-original-verse-section',destinationNote:a.destinationNote}
}
export const getUthayminReviewedBookLink=(slug:string,surah:number,ayah:number)=>uthayminReviewedBookLink(data,definitions,slug,surah,ayah)

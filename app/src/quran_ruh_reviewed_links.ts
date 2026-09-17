import data from './quran_ruh_reviewed_links.generated.json'
import definitions from './quran_source_editions.generated.json'
import type {ReviewedOriginalBookLink} from './quran_source_reviewed_links'
interface Anchor {surah:number;ayah:number;pageIndex:number;sourceRowId:string;bodySha256:string;nextBodySha256:string;sourceTextSha256:string;evidenceSha256:string;rootStart:number;rootEnd:number}
interface Review {schemaVersion:number;bookSha256:string;manifestSha256:string;anchors:readonly Anchor[]}
const allowed=new Set('5:109 5:112 5:113 5:115 5:116 5:117 6:57 6:58 6:63 6:64 6:68 6:69 6:70 6:71 9:45 9:46 9:47 9:48 9:49 9:52 9:53 9:54 9:57 9:58 9:60 9:62 9:64 10:5 10:7 10:11 10:13 10:14 10:16 10:18 10:19 10:22 10:25 10:32 10:35 10:37 10:40 10:41 14:9 14:12 14:14 14:15 14:16 14:18 14:22 14:25 14:31 14:33 16:53 16:54 16:57 16:58 16:59 16:63 16:64 16:68 16:69 16:72 16:83 16:84'.split(' '))
/** First canonical quotation and two independent original commentary witnesses, pinned to the source manifest. */
export function ruhReviewedLink(review:Review,defs:readonly {slug:string;manifestSha256:string}[],slug:string,surah:number,ayah:number):ReviewedOriginalBookLink|undefined{
 if(slug!=='ruh-al-maani'||!allowed.has(`${surah}:${ayah}`)||review.schemaVersion!==1||review.bookSha256!=='8624641f5f189b74ae28c5de7d95d00269d594cf894f8239fa35c8cdef90f9d9'||defs.find(d=>d.slug===slug)?.manifestSha256!==review.manifestSha256)return
 const matches=review.anchors.filter(a=>a.surah===surah&&a.ayah===ayah);if(matches.length!==1)return;const a=matches[0]!
 if(![a.pageIndex,a.rootStart,a.rootEnd].every(Number.isInteger)||a.rootStart<0||a.pageIndex<a.rootStart||a.pageIndex+1>=a.rootEnd||a.sourceRowId!==String(a.pageIndex+1)||![a.bodySha256,a.nextBodySha256,a.sourceTextSha256,a.evidenceSha256].every(h=>/^[a-f0-9]{64}$/.test(h)))return
 return{bookId:'410022835',pageIndex:a.pageIndex,sourceRowId:a.sourceRowId,href:`#/reader/410022835?pageIndex=${a.pageIndex}`,method:'reviewed-original-verse-section',destinationNote:'موضع الآية مثبت باقتباسها وشاهدين من كلام المفسر في الأصل'}
}
export const getRuhReviewedLink=(slug:string,surah:number,ayah:number)=>ruhReviewedLink(data,definitions,slug,surah,ayah)

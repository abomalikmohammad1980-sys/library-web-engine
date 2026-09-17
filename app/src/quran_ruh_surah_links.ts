import data from './quran_ruh_surah_links.generated.json'
import pairedData from './quran_ruh_paired_links.generated.json'
import leadingData from './quran_ruh_leading_links.generated.json'
import shortPairData from './quran_ruh_short_pair_links.generated.json'
import shortOpeningData from './quran_ruh_short_opening_links.generated.json'
import quoteAlifData from './quran_ruh_quote_alif_links.generated.json'
import alifLeadingData from './quran_ruh_alif_leading_links.generated.json'
import adjacentData from './quran_ruh_adjacent_links.generated.json'
import definitions from './quran_source_editions.generated.json'
import type {ReviewedOriginalBookLink} from './quran_source_reviewed_links'
interface Review {schemaVersion:number;bookSha256:string;manifestSha256:string;anchors:readonly {surah:number;ayah:number;pageIndex:number;sourceRowId:string;rootStart:number;rootEnd:number;bodySha256:string;nextBodySha256:string;sourceTextSha256:string;evidenceSha256:string}[]}
const allowed=new Set('5:104 5:114 6:56 9:65 10:9 10:15 10:26 10:28 14:6 14:8 14:13 16:55 16:60 16:61 16:66 16:73 16:82 5:118 6:59 9:44 9:66 10:4 10:36 14:21 16:62 16:65 16:71 16:76 5:97 5:103 9:61 10:2 10:39 14:7'.split(' '))
for(const key of ['5:107','14:20','14:28','16:77'])allowed.add(key)
for(const key of ['5:102','6:66','9:50','10:30','14:30'])allowed.add(key)
for(const key of ['5:120','6:73','14:23','14:32','16:52'])allowed.add(key)
for(const key of ['5:105','16:74'])allowed.add(key)
for(const key of ['5:106','5:108','10:3','14:27','14:29'])allowed.add(key)
/** Verified surah identity, unique opening within that surah, and two unique original prose witnesses. */
export function ruhSurahLink(review:Review,defs:readonly {slug:string;manifestSha256:string}[],slug:string,surah:number,ayah:number):ReviewedOriginalBookLink|undefined{
 if(slug!=='ruh-al-maani'||!allowed.has(`${surah}:${ayah}`)||review.schemaVersion!==1||review.bookSha256!=='8624641f5f189b74ae28c5de7d95d00269d594cf894f8239fa35c8cdef90f9d9'||defs.find(d=>d.slug===slug)?.manifestSha256!==review.manifestSha256)return
 const matches=review.anchors.filter(a=>a.surah===surah&&a.ayah===ayah);if(matches.length!==1)return;const a=matches[0]!
 if(![a.pageIndex,a.rootStart,a.rootEnd].every(Number.isInteger)||a.rootStart<0||a.pageIndex<a.rootStart||a.pageIndex+1>=a.rootEnd||a.sourceRowId!==String(a.pageIndex+1)||![a.bodySha256,a.nextBodySha256,a.sourceTextSha256,a.evidenceSha256].every(h=>/^[a-f0-9]{64}$/.test(h)))return
 return{bookId:'410022835',pageIndex:a.pageIndex,sourceRowId:a.sourceRowId,href:`#/reader/410022835?pageIndex=${a.pageIndex}`,method:'reviewed-original-verse-section',destinationNote:'موضع الآية مثبت بسورتها واقتباسها وشاهدين من كلام المفسر في الأصل'}
}
export const getRuhSurahLink=(slug:string,surah:number,ayah:number)=>ruhSurahLink(data,definitions,slug,surah,ayah)??ruhSurahLink(pairedData,definitions,slug,surah,ayah)??ruhSurahLink(leadingData,definitions,slug,surah,ayah)??ruhSurahLink(shortPairData,definitions,slug,surah,ayah)??ruhSurahLink(shortOpeningData,definitions,slug,surah,ayah)??ruhSurahLink(quoteAlifData,definitions,slug,surah,ayah)??ruhSurahLink(alifLeadingData,definitions,slug,surah,ayah)??ruhSurahLink(adjacentData,definitions,slug,surah,ayah)

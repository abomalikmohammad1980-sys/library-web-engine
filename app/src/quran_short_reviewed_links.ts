import data from './quran_short_reviewed_links.generated.json'
import definitions from './quran_source_editions.generated.json'
import type {ReviewedOriginalBookLink} from './quran_source_reviewed_links'
interface Anchor {slug:string;surah:number;ayah:number;bookId:string;bookSha256:string;manifestSha256:string;pageIndex:number;sourceRowId:string;bodySha256:string;nextBodySha256?:string;sourceTextSha256:string;evidenceSha256:string;rootStart:number;rootEnd:number}
interface Review {schemaVersion:number;anchors:readonly Anchor[]}
const allowed:Readonly<Record<string,{bookId:string;sha:string;keys:readonly string[]}>>={
 'ibn-juzayy':{bookId:'410023626',sha:'e7bcbab6706800077e4308d050e4f1f72f85facfd022b963849701729aef3905',keys:['53:16','53:17','53:18','53:19','53:21','53:22','53:24']},
 kashshaf:{bookId:'410023627',sha:'731e178bdcd95edccf821767b12564ea84a7fe8d414b16a1288d3e2057a001bd',keys:['26:224','29:50','44:49','44:50','54:8']},
}
/** Pinned canonical-opening and original-commentary proofs, within a verified numbered surah. */
export function shortReviewedLink(review:Review,defs:readonly {slug:string;manifestSha256:string}[],slug:string,surah:number,ayah:number):ReviewedOriginalBookLink|undefined{
 const config=Object.hasOwn(allowed,slug)?allowed[slug]:undefined;if(!config||review.schemaVersion!==1||!config.keys.includes(`${surah}:${ayah}`))return
 const matches=review.anchors.filter(a=>a.slug===slug&&a.surah===surah&&a.ayah===ayah);if(matches.length!==1)return
 const a=matches[0]!,definition=defs.find(d=>d.slug===slug);if(!definition||a.manifestSha256!==definition.manifestSha256||a.bookId!==config.bookId||a.bookSha256!==config.sha||![a.pageIndex,a.rootStart,a.rootEnd].every(Number.isInteger)||a.rootStart<0||a.pageIndex<a.rootStart||a.pageIndex>=a.rootEnd||a.sourceRowId!==String(a.pageIndex+1)||![a.bodySha256,a.sourceTextSha256,a.evidenceSha256].every(h=>/^[a-f0-9]{64}$/.test(h)))return
 if(a.nextBodySha256!==undefined&&(!/^[a-f0-9]{64}$/.test(a.nextBodySha256)||a.pageIndex+1>=a.rootEnd))return
 return{bookId:a.bookId,pageIndex:a.pageIndex,sourceRowId:a.sourceRowId,href:`#/reader/${a.bookId}?pageIndex=${a.pageIndex}`,method:'reviewed-original-verse-section',destinationNote:'موضع الآية مثبت بافتتاحها ونص تفسيرها في الأصل'}
}
export const getShortReviewedLink=(slug:string,surah:number,ayah:number)=>shortReviewedLink(data,definitions,slug,surah,ayah)

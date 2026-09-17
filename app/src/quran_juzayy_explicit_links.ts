import data from './quran_juzayy_explicit_links.generated.json'
import definitions from './quran_source_editions.generated.json'
import type {ReviewedOriginalBookLink} from './quran_source_reviewed_links'
interface Anchor {surah:number;ayah:number;globalId:number;pageIndex:number;sourceRowId:string;bodySha256:string;sectionSha256:string;sourceTextSha256:string;evidenceSha256:string;rootEvidenceSha256:string}
interface Review {schemaVersion:number;bookSha256:string;manifestSha256:string;anchors:readonly Anchor[]}
const allowed:Readonly<Record<string,number>>={'17:12':2041,'17:13':2042,'17:14':2043,'17:15':2044,'17:16':2045,'17:17':2046,'53:20':4804,'53:23':4807}
export function juzayyExplicitLink(review:Review,defs:readonly {slug:string;manifestSha256:string}[],slug:string,surah:number,ayah:number):ReviewedOriginalBookLink|undefined{
 const key=`${surah}:${ayah}`;if(slug!=='ibn-juzayy'||!Object.hasOwn(allowed,key)||review.schemaVersion!==1||review.bookSha256!=='14202804470f3096ee1dd979df7fb3cb73a8f79f2df95077d5c27259df9a33a0'||defs.find(d=>d.slug===slug)?.manifestSha256!==review.manifestSha256)return
 const matches=review.anchors.filter(a=>a.surah===surah&&a.ayah===ayah);if(matches.length!==1)return;const a=matches[0]!
 if(a.globalId!==allowed[key]||!Number.isInteger(a.pageIndex)||a.pageIndex<0||a.sourceRowId!==String(a.pageIndex+1)||![a.bodySha256,a.sectionSha256,a.sourceTextSha256,a.evidenceSha256,a.rootEvidenceSha256].every(h=>/^[a-f0-9]{64}$/.test(h)))return
 return{bookId:'410030186',pageIndex:a.pageIndex,sourceRowId:a.sourceRowId,href:`#/reader/410030186?pageIndex=${a.pageIndex}`,method:'reviewed-original-verse-section',destinationNote:'موضع الآية في نسخة أصلية أخرى من التفسير؛ ثبت بمعرف الآية ونصها'}
}
export const getJuzayyExplicitLink=(slug:string,surah:number,ayah:number)=>juzayyExplicitLink(data,definitions,slug,surah,ayah)

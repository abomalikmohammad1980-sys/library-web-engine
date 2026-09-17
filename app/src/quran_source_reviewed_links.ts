import data from './quran_source_reviewed_links.generated.json'
import definitions from './quran_source_editions.generated.json'

export interface ReviewedOriginalBookLink {
  bookId:string;pageIndex:number;sourceRowId:string;href:string
  method:'reviewed-original-verse-section'
  sharedRange?:{surah:number;from:number;to:number}
  destinationNote:string
}
interface ReviewedAnchor {surah:number;ayah:number;pageIndex:number;sourceRowId:string;from:number;to:number;bodySha256:string;evidenceKind:string;nextBodySha256?:string;destinationNote:string}
interface ReviewedAnchor {precedingPageIndex?:number;precedingBodySha256?:string;printedRange?:{surah:number;from:number;to:number}}
interface ReviewedEdition {bookId:string;sourceManifestSha256:string;localBookSha256:string;evidencePolicy:string;anchors:readonly ReviewedAnchor[]}
type Definitions=readonly {slug:string;bookId:number;manifestSha256:string}[]
const evidenceKinds=new Set(['unique-full-numbered-paragraph','explicit-numbered-heading-split-across-two-pages','reviewed-complete-verse-split-into-commentary-quotations','explicit-printed-section-and-unique-next-opening','reviewed-root-numbered-child-and-verse-quote','explicit-named-section-and-unique-next-opening','explicit-named-section-and-joined-next-opening'])
evidenceKinds.add('explicit-named-section-and-unique-internal-quote')
evidenceKinds.add('explicit-named-range-and-unique-later-verse-opening')
const reviewedWorks:Readonly<Record<string,{bookId:number;sha256:string;policy:string}>>={
 'shuoun-nasafy':{bookId:1394,sha256:'aecb79703013c2e6b54c0dfc82ea34e03ba57dc0f5279ef287492de3b6ef2afa',policy:'reviewed-nasafy-original-sections/1'},
 'shuoun-zamanen':{bookId:2154,sha256:'acd45e8cea67c1525261c65e05d67c2913625cc4cdf29626348b563633640c6c',policy:'reviewed-zamanen-original-sections/2'},
}
/** Exact requested key only. Never substitute the adjacent verse or infer a page. */
export function reviewedOriginalBookLink(editions:Readonly<Record<string,ReviewedEdition>>,sourceDefinitions:Definitions,slug:string,surah:number,ayah:number):ReviewedOriginalBookLink|undefined {
 if(!Object.hasOwn(reviewedWorks,slug)||!Object.hasOwn(editions,slug)||!Number.isInteger(surah)||!Number.isInteger(ayah)||surah<1||surah>114||ayah<1||ayah>286)return
 const work=reviewedWorks[slug]!
 const edition=editions[slug],definition=sourceDefinitions.find(d=>d.slug===slug)
 if(!edition||!definition||definition.bookId!==work.bookId||edition.bookId!==String(410000000+work.bookId)||definition.manifestSha256!==edition.sourceManifestSha256||edition.evidencePolicy!==work.policy||edition.localBookSha256!==work.sha256)return
 const matches=edition.anchors.filter(a=>a.surah===surah&&a.ayah===ayah)
 if(matches.length!==1)return
 const a=matches[0]!
 if((slug==='shuoun-zamanen')!==['explicit-printed-section-and-unique-next-opening','reviewed-root-numbered-child-and-verse-quote','explicit-named-section-and-unique-next-opening','explicit-named-section-and-joined-next-opening','explicit-named-section-and-unique-internal-quote','explicit-named-range-and-unique-later-verse-opening'].includes(a.evidenceKind))return
 if(!Number.isInteger(a.pageIndex)||a.pageIndex<0||typeof a.sourceRowId!=='string'||!a.sourceRowId||!Number.isInteger(a.from)||!Number.isInteger(a.to)||a.from<1||a.from>ayah||a.to<ayah||a.to>286||!evidenceKinds.has(a.evidenceKind)||!(/^[a-f0-9]{64}$/).test(a.bodySha256)||!a.destinationNote)return
 if(a.evidenceKind==='explicit-named-range-and-unique-later-verse-opening'){
  const r=a.printedRange
  if(a.precedingPageIndex!==a.pageIndex-1||!(/^[a-f0-9]{64}$/).test(a.precedingBodySha256??'')||!r||r.surah!==surah||!Number.isInteger(r.from)||!Number.isInteger(r.to)||r.from<1||r.from>=ayah||r.to<ayah||r.to>286||a.from!==ayah||a.to!==ayah)return
 }else if(!['unique-full-numbered-paragraph','reviewed-root-numbered-child-and-verse-quote'].includes(a.evidenceKind)&&!(/^[a-f0-9]{64}$/).test(a.nextBodySha256??''))return
 return {bookId:edition.bookId,pageIndex:a.pageIndex,sourceRowId:a.sourceRowId,href:`#/reader/${edition.bookId}?pageIndex=${a.pageIndex}`,method:'reviewed-original-verse-section',destinationNote:a.destinationNote,...(a.from<a.to?{sharedRange:{surah,from:a.from,to:a.to}}:{})}
}
export const getReviewedOriginalBookLink=(slug:string,surah:number,ayah:number)=>reviewedOriginalBookLink(data.editions,definitions,slug,surah,ayah)

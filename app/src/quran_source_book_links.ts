import data from './quran_source_book_links.generated.json'
import {getMaterializedSourceBookLink,type MaterializedSourceBookLink} from './quran_source_materialized_books'
import {getNumberedHeadingBookLink,type NumberedHeadingBookLink} from './quran_source_heading_links'
import {getReviewedOriginalBookLink,type ReviewedOriginalBookLink} from './quran_source_reviewed_links'
import {getUthayminReviewedBookLink} from './quran_uthaymin_reviewed_links'
import {getMathoorReviewedLink} from './quran_mathoor_reviewed_links'
import {getFathReviewedLink} from './quran_fath_reviewed_links'
import {getShortReviewedLink} from './quran_short_reviewed_links'
import {getJuzayyExplicitLink} from './quran_juzayy_explicit_links'
import {getRuhReviewedLink} from './quran_ruh_reviewed_links'
import {getKashshafBoundedLink} from './quran_kashshaf_bounded_link'
import {getReviewedExcerptBookLink} from './quran_reviewed_excerpts'
import {getRuhSurahLink} from './quran_ruh_surah_links'

export type SourceEditionBookLink = MaterializedSourceBookLink | NumberedHeadingBookLink | ReviewedOriginalBookLink | {bookId:string;pageIndex:number;sourceRowId:string;href:string;method?:'explicit-local-verse-toc';sharedRange?:{surah:number;from:number;to:number}}
/** Proven text matches or explicit verse headings in the original library work; never guessed pagination. */
export function getSourceEditionBookLink(slug:string,surah:number,ayah:number):SourceEditionBookLink|undefined {
 if(!Number.isInteger(surah)||!Number.isInteger(ayah)||surah<1||surah>114||ayah<1||ayah>286)return
 const materialized=getMaterializedSourceBookLink(slug,surah,ayah);if(materialized)return materialized
 const editions=data.editions as Record<string,Record<string,Array<number|string>>>
 const record=Object.hasOwn(editions,slug)?editions[slug]?.[`${surah}:${ayah}`]:undefined
 if(!record)return getNumberedHeadingBookLink(slug,surah,ayah)??getReviewedOriginalBookLink(slug,surah,ayah)??getUthayminReviewedBookLink(slug,surah,ayah)??getMathoorReviewedLink(slug,surah,ayah)??getFathReviewedLink(slug,surah,ayah)??getShortReviewedLink(slug,surah,ayah)??getJuzayyExplicitLink(slug,surah,ayah)??getRuhReviewedLink(slug,surah,ayah)??getKashshafBoundedLink(slug,surah,ayah)??getReviewedExcerptBookLink(slug,surah,ayah)??getRuhSurahLink(slug,surah,ayah)
 if(!record||![3,5].includes(record.length))return
 const [id,index,row]=record
 if(typeof id!=='number'||!Number.isInteger(id)||typeof index!=='number'||!Number.isInteger(index)||index<0||typeof row!=='string')return
 const bookId=String(id)
 if(record.length===5){const from=record[3],to=record[4];if(typeof from!=='number'||typeof to!=='number'||!Number.isInteger(from)||!Number.isInteger(to)||from<1||to>286||from>ayah||to<ayah)return;return {bookId,pageIndex:index,sourceRowId:row,href:`#/reader/${bookId}?pageIndex=${index}`,method:'explicit-local-verse-toc',...(from<to?{sharedRange:{surah,from,to}}:{})}}
 return {bookId,pageIndex:index,sourceRowId:row,href:`#/reader/${bookId}?pageIndex=${index}`}
}

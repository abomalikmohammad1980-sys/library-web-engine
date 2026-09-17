import data from './quran_source_materialized_books.generated.json'

export interface MaterializedSourceBookLink {bookId:string;sourceRowId:string;href:string;method:'explicit-source-verse-book';pageIndex?:never;sharedRange?:never}
export interface MaterializedSourceBook {workId:string;sourceManifestSha256:string;verses:readonly string[]}
export function materializedSourceBookLink(editions:Readonly<Record<string,MaterializedSourceBook>>,slug:string,surah:number,ayah:number):MaterializedSourceBookLink|undefined{
 if(!Object.hasOwn(editions,slug)||!/^shuoun-[a-z]+$/.test(slug)||!Number.isInteger(surah)||!Number.isInteger(ayah)||surah<1||surah>114||ayah<1||ayah>286)return
 const work=editions[slug],key=`${surah}:${ayah}`
 if(!work||work.workId!==`tafsir-${slug}`||!/^[a-f0-9]{64}$/.test(work.sourceManifestSha256)||!work.verses.includes(key))return
 return {bookId:work.workId,sourceRowId:key,href:`#/reader/${work.workId}?surah=${surah}&ayah=${ayah}`,method:'explicit-source-verse-book'}
}
export const MATERIALIZED_SOURCE_BOOKS=data.editions as Readonly<Record<string,MaterializedSourceBook>>
export const getMaterializedSourceBookLink=(slug:string,surah:number,ayah:number)=>materializedSourceBookLink(MATERIALIZED_SOURCE_BOOKS,slug,surah,ayah)

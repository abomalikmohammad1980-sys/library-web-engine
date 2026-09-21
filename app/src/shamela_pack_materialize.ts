import type {StoredBook} from './engine/library_store'
import {deterministicCoverHue,deterministicCoverTemplate} from './book_cover_identity'
import {cleanShamelaPlainText,parseShamelaStructuralText,remapShamelaPlainTextOffset,displayableHijriPublicationYear} from './shamela_text_presentation'
import {shamelaPublicBookId} from './shamela_public_identity'
import {CURRENT_SHAMELA_PACK_TEXT_VERSION} from './shamela_reader_contract'
export const UNKNOWN_SHAMELA_AUTHOR = 'المؤلف مجهول'
export interface PackBook { contract: 'shamela-sqlite-pack/book-1'; workId: string; metadata: { bookName: string | null; bookDate: number | null; categoryId: string | null; metaDataRaw: string | null }; authors: Array<{ authorId: string; authorName: string | null; role: string; deathNumber: number | null }>; category: { categoryName: string | null } | null; pages: Array<{ sourceRowId:string; sequence:number; part:string|null; page:number|null; number?:number|null; body:string|null; foot:string|null; inlineControls?:Array<{kind:'separator'|'style';field:'body'|'foot';offset:number;level?:number;length?:number}> }>; titles: Array<{ sourceRowId: string; pageSourceRowId: string | null; parentSourceRowId: string | null; title: string | null }> }
export function isUnknownShamelaAuthor(value:string|null|undefined):boolean {const author=value?.trim();return !author||author==='-'||author==='غير معروف'||author===UNKNOWN_SHAMELA_AUTHOR||author==='مؤلف غير موثق'}
export function isPlaceholderShamelaTitle(value: string | null | undefined): boolean {
  return /^كتاب\s+الشاملة(?:\s+رقم)?\s+[0-9٠-٩]+$/u.test(value?.trim() ?? '')
}

export function verifiedShamelaTitle(...candidates: Array<string | null | undefined>): string {
  const normalized = candidates.map(value => value?.normalize('NFC').replace(/[\u0000-\u001f\u007f]/gu,' ').replace(/\s+/gu,' ').trim()).filter((value): value is string => Boolean(value))
  const title = normalized.find(value => !isPlaceholderShamelaTitle(value))
  if (!title) throw new Error('shamela_pack_book_title_missing')
  return title
}
export function materializeShamelaPackBook(source: PackBook, packed: Uint8Array, digest: string, catalogTitle?: string | null): StoredBook {
  if(source.contract!=='shamela-sqlite-pack/book-1'||!source.pages.length)throw new Error('shamela_pack_book_invalid')
  const title=verifiedShamelaTitle(source.metadata.bookName,catalogTitle)
  const primary=source.authors.find(x=>x.role==='main')??source.authors[0]
  const bokPages=source.pages.map((page,index)=>{const rawBody=page.body??'',rawFoot=page.foot??'',parsedBody=parseShamelaStructuralText(rawBody),parsedFoot=parseShamelaStructuralText(rawFoot),body=parsedBody.text,foot=parsedFoot.text,separator=body&&foot?'\n_________\n':'',text=[body,foot].filter(Boolean).join(separator),storedControls=page.inlineControls?.map(control=>({...control,offset:control.field==='foot'?body.length+separator.length+remapShamelaPlainTextOffset(rawFoot,control.offset):remapShamelaPlainTextOffset(rawBody,control.offset)})),inferredControls=[...parsedBody.controls,...parsedFoot.controls.map(control=>({...control,offset:body.length+separator.length+control.offset}))],controls=storedControls?.length?storedControls:inferredControls,hadithNumber=Number(page.number);return{id:Number(page.sourceRowId),text,part:Number(page.part)||1,page:page.page??index+1,...(Number.isSafeInteger(hadithNumber)&&hadithNumber>0?{hadithNumber}:{}),...controls.length?{controls}: {}}})
  const titleById=new Map(source.titles.map(x=>[x.sourceRowId,x])); const level=(row:PackBook['titles'][number])=>{let n=1,p=row.parentSourceRowId,guard=0;while(p&&guard++<32){n++;p=titleById.get(p)?.parentSourceRowId??null}return n}
  const bokToc=source.titles.filter(x=>x.title!=null).map(x=>({id:Number(x.pageSourceRowId??x.sourceRowId),title:cleanShamelaPlainText(x.title!),level:level(x),parent:Number(x.parentSourceRowId)||0}))
  const primaryName=primary?.authorName?.trim(),author=isUnknownShamelaAuthor(primaryName)?UNKNOWN_SHAMELA_AUTHOR:primaryName!, now=Date.now()
  const publicationYearHijri=displayableHijriPublicationYear(source.metadata.bookDate)
  const sourceBookId=source.workId.split(':').at(-1)!
  return {id:shamelaPublicBookId(sourceBookId),sourceKind:'shamela4.1',sourceBookId,managedSource:'published',sourceFormat:'shamela-bok',title,author,...(primary&&author!==UNKNOWN_SHAMELA_AUTHOR?{authorId:`shamela-author-${primary.authorId}`} : {}),authors:source.authors.filter(x=>!isUnknownShamelaAuthor(x.authorName)).map(x=>({id:`shamela-author-${x.authorId}`,name:x.authorName!})),...(primary?.deathNumber!=null&&primary.deathNumber!==99999&&author!==UNKNOWN_SHAMELA_AUTHOR?{deathYearHijri:primary.deathNumber}:{}),...(source.category?.categoryName?{category:source.category.categoryName}:{}),...(publicationYearHijri!=null?{publicationYearHijri}:{}),...(source.metadata.metaDataRaw!=null?{rawSourceMetadata:source.metadata.metaDataRaw}:{}),fileName:`${source.workId.replace(':','-')}.json`,fileSize:packed.byteLength,addedAt:now,data:packed,mimeType:'application/vnd.alkhizana.shamela-pack+json',originalSha256:digest,pdfStatus:'pending',coverHue:deterministicCoverHue(title),coverTemplate:deterministicCoverTemplate(title),extractedText:bokPages.map(x=>x.text).join('\n\n'),bokPages,bokToc,bokTextVersion:CURRENT_SHAMELA_PACK_TEXT_VERSION,physicalPageCount:bokPages.length,readerPageCount:bokPages.length,sourceCitation:`الشاملة 4.1 — ${source.workId}`}
}

import type {BookIntakeFields,StoredBook} from './engine/library_store'
import {localOriginalAsset} from './library_card_state'
import {createWordBundleUpload,type WordBundleProof} from './word_bundle_transfer'
export type CentralBookPublicMetadata=Pick<BookIntakeFields,'publisher'|'edition'|'investigator'|'publicationYearHijri'|'description'|'rawSourceMetadata'|'volumeCount'|'deathYearHijri'|'contemporary'|'tags'|'coverHue'|'coverTemplate'|'authors'|'authorId'>&{schemaVersion:1;centralAuthorId?:string;parts?:StoredBook['parts']}
export interface CentralBookUploadInput {file:File;title:string;author:string;category?:string;metadata?:CentralBookPublicMetadata;volumeFiles?:File[];pdfFile?:File;coverFile?:File;wordMapFile?:File;wordBundle?:WordBundleProof}
export async function centralBookUploadWithWordBundle(input:CentralReviewedBook):Promise<CentralBookUploadInput>{
 return {...centralBookUploadInput(input),...await createWordBundleUpload(input.book)}
}
export interface CentralReviewedBook {localBookId:string;metadata:BookIntakeFields;files:File[];book:StoredBook}
const binaryFile=(data:Uint8Array,name:string,type:string)=>new File([Uint8Array.from(data)],name,{type})
const wordName=(name:string,format?:string)=>format==='word'&&/\.(doc|rtf)$/i.test(name)?name.replace(/\.(doc|rtf)$/i,'.docx'):name
/** Only reviewed bibliographic fields and selected book assets cross the public boundary. */
export function centralBookUploadInput(input:CentralReviewedBook):CentralBookUploadInput{
 const {book,metadata:reviewed}=input,metadata:CentralBookPublicMetadata={schemaVersion:1}
 for(const key of ['publisher','edition','investigator','description','rawSourceMetadata'] as const){const value=reviewed[key];if(value?.trim())metadata[key]=value.trim()}
 for(const key of ['publicationYearHijri','volumeCount','deathYearHijri','coverHue','coverTemplate'] as const){const value=reviewed[key];if(value!==undefined)metadata[key]=value}
 if(reviewed.contemporary!==undefined)metadata.contemporary=reviewed.contemporary
 if(reviewed.authorId?.startsWith('central-author:'))metadata.centralAuthorId=reviewed.authorId
 else if(reviewed.authorId&&/^shamela-author-[1-9]\d{0,5}$/.test(reviewed.authorId))metadata.authorId=reviewed.authorId
 if(reviewed.authors?.length)metadata.authors=reviewed.authors.map(({name,id})=>({name,...(id?{id}:{})}))
 if(reviewed.tags?.length)metadata.tags=reviewed.tags.map(({name,source,confidence,paragraphIndex,pageId})=>({name,source,...(confidence!==undefined?{confidence}:{}),...(paragraphIndex!==undefined?{paragraphIndex}:{}),...(pageId!==undefined?{pageId}:{})}))
 if(book.parts?.length)metadata.parts=book.parts.map(({number,title,startPage,endPage,wordStartPage})=>({number,startPage,endPage,...(title?{title}:{}),...(wordStartPage!==undefined?{wordStartPage}:{})}))
 const sources=book.volumes?.length?book.volumes:[book]
 const files=sources.map(source=>{
  if(book.sourceFormat==='shamela-bok'){
   const original=localOriginalAsset({...source,sourceFormat:book.sourceFormat})
   if(!original)throw Error('bok_original_source_unavailable')
   return binaryFile(original.bytes,original.fileName,original.mimeType)
  }
  return binaryFile(source.data,wordName(source.fileName,book.sourceFormat),book.sourceFormat==='word'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':source.mimeType)
 })
 if(!files[0])throw Error('account_book_file_invalid')
 const result:CentralBookUploadInput={file:files[0],title:reviewed.title,author:reviewed.author,...(reviewed.category?{category:reviewed.category}:{}),metadata}
 if(files.length>1)result.volumeFiles=files.slice(1)
 if(book.pdfStatus==='ready'&&book.pdfData?.byteLength&&book.sourceFormat!=='pdf')result.pdfFile=binaryFile(book.pdfData,book.pdfFileName||'book.pdf','application/pdf')
 if(book.customCoverData?.byteLength&&book.customCoverMimeType){const extension=({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'} as Record<string,string>)[book.customCoverMimeType];if(!extension)throw Error('account_book_cover_invalid');result.coverFile=binaryFile(book.customCoverData,'cover.'+extension,book.customCoverMimeType)}
 return result
}

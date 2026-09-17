import {resolvePublicBookOriginal,type PublicBookOriginal} from './public_book_resolver'
import type {StoredBook} from './engine/library_store'
import {projectBookAuthorNames} from './author_display_names'
export const isPublicReaderId=(id:string):boolean=>id.startsWith('central-submission:')
export function createPublicReaderRegistry(load:(id:string,options:{signal?:AbortSignal})=>Promise<PublicBookOriginal>=resolvePublicBookOriginal,privateAccount=false){
 let active:StoredBook|undefined,generation=0
 return {
  get:(id:string)=>active?.id===id?active:undefined,
  release:(book:StoredBook)=>{if(active===book){active=undefined;generation++}},
  async resolve(id:string,signal?:AbortSignal):Promise<StoredBook>{
   const match=(privateAccount?/^account-book:([A-Za-z0-9_-]{1,200})$/:/^central-submission:([A-Za-z0-9_-]{1,200})$/).exec(id)
   if(!match)throw new Error('public_book_id_invalid')
   const ticket=++generation;active=undefined
   const source=await load(match[1]!,signal?{signal}:{})
   if(signal?.aborted||ticket!==generation)throw new Error('public_book_aborted')
   if(source.identity!==id)throw new Error('public_book_id_invalid')
   const meta=source.metadata
   const book:StoredBook={id,title:meta.title,author:meta.author,...(meta.category?{category:meta.category}:{}),managedSource:'published',visibility:'public',fileName:meta.fileName,fileSize:source.data.length,data:source.data,mimeType:meta.mimeType,sourceFormat:meta.sourceFormat,addedAt:Date.parse(meta.createdAt)||0,originalSha256:'',pdfStatus:meta.sourceFormat==='pdf'?'ready':'pending',...(meta.sourceFormat==='pdf'?{pdfData:source.data,pdfFileName:meta.fileName,pdfEngine:'original'}:{})}
   if(privateAccount){delete book.managedSource;delete book.visibility}
   if(meta.metadata){const {schemaVersion:_,centralAuthorId,...fields}=meta.metadata;Object.assign(book,fields);if(centralAuthorId)book.authorId=centralAuthorId}
   for(const {asset,data} of source.assetData??[]){
    if(asset.kind==='pdf'){book.pdfData=data;book.pdfFileName=asset.fileName;book.pdfStatus='ready';book.pdfEngine='original'}
    else if(asset.kind==='cover'){book.customCoverData=data;book.customCoverMimeType=asset.mimeType}
    else{book.volumes??=[{number:1,fileName:meta.fileName,data:source.data,mimeType:meta.mimeType}];book.volumes.push({number:asset.partNumber!,fileName:asset.fileName,data,mimeType:asset.mimeType})}
   }
   if(source.wordPageMap){
    book.wordPageMap=source.wordPageMap
    book.paginationAuthority='word-map'
    book.pdfEngine='microsoft-word-companion-v1'
   }
   book.volumes?.sort((a,b)=>a.number-b.number)
   active=projectBookAuthorNames(book);return active
  },
 }
}

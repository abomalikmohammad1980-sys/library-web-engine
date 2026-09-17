import {assertBookFormat} from './book_format_validation'
import type {BookFormat} from './book_format'
import type {PublishedCatalogBook} from './published_books_catalog_client'
import {parsePublicBookMetadata,parsePublicBookAssets,type PublicBookMetadata,type PublicBookAsset} from './public_book_metadata'
import {parseWordBundleMetadata,verifyTransferredWordBundle,type WordBundleMetadata} from './word_bundle_transfer'
import type {WordPageMap} from './engine/library_store'

type Fetcher=(input:string,init?:RequestInit)=>Promise<Response>
export interface PublicBookResolverOptions {fetch?:Fetcher;signal?:AbortSignal}
export interface PublicBookOriginal {
 identity:string
 publicId:string
 metadata:PublishedCatalogBook&{fileName:string;sourceFormat:BookFormat;publicationVersion:number;metadata?:PublicBookMetadata;assets?:PublicBookAsset[];wordBundle?:WordBundleMetadata}
 wordPageMap?:WordPageMap
 data:Uint8Array
 assetData?:Array<{asset:PublicBookAsset;data:Uint8Array}>
 /** No server content digest exists yet. Size/signature checks are not SHA verification. */
 integrity:{kind:'size-and-format-only'}
}
const fail=(code:string):never=>{throw new Error(code)}
const checkAbort=(signal?:AbortSignal)=>{if(signal?.aborted)fail('public_book_aborted')}
async function readBounded(response:Response,max:number,signal?:AbortSignal):Promise<Uint8Array>{
 if(!response.body||Number(response.headers.get('content-length'))>max)return fail('public_book_size_invalid')
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0
 const abort=()=>{void reader.cancel().catch(()=>undefined)};signal?.addEventListener('abort',abort,{once:true})
 try{while(true){checkAbort(signal);const part=await reader.read();checkAbort(signal);if(part.done)break;length+=part.value.length;if(length>max)fail('public_book_size_invalid');chunks.push(part.value)}}catch(error){await reader.cancel().catch(()=>undefined);throw error}finally{signal?.removeEventListener('abort',abort);reader.releaseLock()}
 const data=new Uint8Array(length);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}return data
}
function record(value:unknown):Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:fail('public_book_metadata_invalid')}
function text(value:unknown,max:number):string{return typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f]/.test(value)?value:fail('public_book_metadata_invalid')}
async function fetchMetadata(id:string,fetcher:Fetcher,signal?:AbortSignal):Promise<PublicBookOriginal['metadata']>{
 checkAbort(signal)
 const response=await fetcher(`/api/library/published-books?id=${encodeURIComponent(id)}`,{credentials:'omit',cache:'no-store',redirect:'error',...(signal?{signal}:{})})
 checkAbort(signal)
 if(!response.ok){await response.body?.cancel();return fail('public_book_unavailable')}
 if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))return fail('public_book_metadata_invalid')
 const root=record(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBounded(response,128*1024,signal)))),row=record(root.book)
 if(root.schemaVersion!==1||row.id!==id||row.fileUrl!==`/api/account/books/${id}/file`||row.visibility!==undefined&&row.visibility!=='public'||row.reviewStatus!==undefined&&row.reviewStatus!=='approved'||row.review_status!==undefined&&row.review_status!=='approved'||row.deleted_at!=null)return fail('public_book_metadata_invalid')
 const fileName=text(row.fileName,120)
 if(/[/\\%]/.test(fileName)||/^\.+$/.test(fileName))return fail('public_book_metadata_invalid')
 const formats:Record<string,BookFormat>={docx:'word',pdf:'pdf',epub:'epub',bok:'shamela-bok',txt:'text',md:'markdown'}
 const format=formats[fileName.split('.').at(-1)!.toLowerCase()]
 // DOC/RTF need a conversion service; never feed them to the existing DOCX parser.
 if(!format||row.sourceFormat!==format)return fail('public_book_format_unsupported')
 if(!Number.isSafeInteger(row.byteLength)||Number(row.byteLength)<1||Number(row.byteLength)>64*1024*1024||!Number.isSafeInteger(row.publicationVersion)||Number(row.publicationVersion)<0)return fail('public_book_metadata_invalid')
 const metadata=parsePublicBookMetadata(row.metadata),assets=parsePublicBookAssets(row.assets,id,Number(row.byteLength)),wordBundle=parseWordBundleMetadata(row.wordBundle,id)
 if(wordBundle&&(format!=='word'||assets.filter(a=>a.kind==='pdf').length!==1||assets.some(a=>a.kind==='volume')||Number(row.byteLength)+assets.reduce((n,a)=>n+a.byteLength,0)+wordBundle.mapBytes>64*1024*1024))return fail('invalid_word_bundle')
 return {id,title:text(row.title,300),author:text(row.author,200),category:row.category===null?null:text(row.category,120),mimeType:text(row.mimeType,150),byteLength:Number(row.byteLength),createdAt:text(row.createdAt,40),fileUrl:`/api/account/books/${id}/file`,fileName,sourceFormat:format,publicationVersion:Number(row.publicationVersion),...(metadata?{metadata}:{}),...(assets.length?{assets}:{}),...(wordBundle?{wordBundle}:{})}
}
export async function resolvePublicBookOriginal(id:string,options:PublicBookResolverOptions={}):Promise<PublicBookOriginal>{
 if(!/^[A-Za-z0-9_-]{1,200}$/.test(id))return fail('public_book_id_invalid')
 const fetcher=options.fetch??fetch,signal=options.signal,metadata=await fetchMetadata(id,fetcher,signal)
 checkAbort(signal)
 const response=await fetcher(metadata.fileUrl,{credentials:'omit',cache:'no-store',redirect:'error',...(signal?{signal}:{})})
 checkAbort(signal)
 if(!response.ok){await response.body?.cancel();return fail('public_book_unavailable')}
 const data=await readBounded(response,metadata.byteLength,signal)
 if(data.length!==metadata.byteLength)return fail('public_book_size_invalid')
 if((metadata.sourceFormat==='text'||metadata.sourceFormat==='markdown')&&data.includes(0))return fail('public_book_format_unsupported')
 assertBookFormat(data,metadata.sourceFormat)
 const assetData:NonNullable<PublicBookOriginal['assetData']>=[]
 // Only the opened book is hydrated; never fetch assets while listing the catalog.
 for(const asset of metadata.assets??[]){
  checkAbort(signal);const response=await fetcher(asset.fileUrl,{credentials:'omit',cache:'no-store',redirect:'error',...(signal?{signal}:{})})
  if(!response.ok){await response.body?.cancel();return fail('public_book_unavailable')}
  const bytes=await readBounded(response,asset.byteLength,signal);if(bytes.length!==asset.byteLength)return fail('public_book_size_invalid')
  if(asset.kind==='cover'){
   const ascii=new TextDecoder().decode(bytes.slice(0,12)),valid=asset.mimeType==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:asset.mimeType==='image/png'?bytes[0]===137&&ascii.slice(1,4)==='PNG':ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP';if(!valid)return fail('public_book_format_unsupported')
  }else{const formats:Record<string,BookFormat>={docx:'word',pdf:'pdf',epub:'epub',bok:'shamela-bok',txt:'text',md:'markdown'},format=asset.kind==='pdf'?'pdf':formats[asset.fileName.split('.').at(-1)!.toLowerCase()];if(!format)return fail('public_book_format_unsupported');assertBookFormat(bytes,format)}
  assetData.push({asset,data:bytes})
 }
 let wordPageMap:WordPageMap|undefined
 if(metadata.wordBundle){
  checkAbort(signal)
  const proof=metadata.wordBundle,pdf=assetData.find(a=>a.asset.kind==='pdf')
  if(!pdf)return fail('invalid_word_bundle')
  const response=await fetcher(proof.mapUrl,{credentials:'omit',cache:'no-store',redirect:'error',...(signal?{signal}:{})})
  if(!response.ok){await response.body?.cancel();return fail('public_book_unavailable')}
  const bytes=await readBounded(response,proof.mapBytes,signal)
  if(bytes.length!==proof.mapBytes)return fail('public_book_size_invalid')
  wordPageMap=await verifyTransferredWordBundle(data,pdf.data,bytes,proof,metadata.fileName)
  checkAbort(signal)
 }
 // The original might have been withdrawn while downloading. Recheck before parsing.
 const current=await fetchMetadata(id,fetcher,signal)
 if(JSON.stringify(current)!==JSON.stringify(metadata))return fail('public_book_changed')
 checkAbort(signal)
 return {identity:`central-submission:${id}`,publicId:id,metadata,data,...(assetData.length?{assetData}:{}),...(wordPageMap?{wordPageMap}:{}),integrity:{kind:'size-and-format-only'}}
}
export async function loadPublicBookWithParser<T>(id:string,parser:(source:PublicBookOriginal)=>T|Promise<T>,options:PublicBookResolverOptions={}):Promise<T>{
 const source=await resolvePublicBookOriginal(id,options);checkAbort(options.signal)
 const parsed=await parser(source);checkAbort(options.signal);return parsed
}

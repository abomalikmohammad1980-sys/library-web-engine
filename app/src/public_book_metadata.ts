import type {StoredBook} from './engine/library_store'
import {isCentralAuthorId} from './central_author_client'
export type PublicBookMetadata=Pick<StoredBook,'publisher'|'edition'|'investigator'|'description'|'rawSourceMetadata'|'authorId'|'authors'|'deathYearHijri'|'contemporary'|'publicationYearHijri'|'volumeCount'|'tags'|'coverHue'|'coverTemplate'|'parts'>&{schemaVersion:1;centralAuthorId?:string}
const fail=():never=>{throw Error('public_book_metadata_invalid')}
const record=(v:any,keys:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k))
const text=(v:any,max:number)=>typeof v==='string'&&v.length<=max&&!/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)
const int=(v:any,min:number,max:number)=>Number.isSafeInteger(v)&&v>=min&&v<=max
const safeId=(v:any)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9:_-]{0,199}$/.test(v)
export function parsePublicBookMetadata(value:unknown):PublicBookMetadata|undefined{
 if(value===undefined||value===null)return undefined
 const x=value as any,strings={publisher:500,edition:300,investigator:500,description:20000,rawSourceMetadata:20000}
 if(!record(x,[...Object.keys(strings),'schemaVersion','authorId','authors','centralAuthorId','deathYearHijri','contemporary','publicationYearHijri','volumeCount','tags','coverHue','coverTemplate','parts'])||x.schemaVersion!==1||new TextEncoder().encode(JSON.stringify(x)).length>65536)return fail()
 for(const [key,max] of Object.entries(strings))if(x[key]!==undefined&&!text(x[key],max))return fail()
 if(x.authorId!==undefined&&!safeId(x.authorId)||x.centralAuthorId!==undefined&&!isCentralAuthorId(x.centralAuthorId))return fail()
 if(x.authors!==undefined&&(!Array.isArray(x.authors)||x.authors.length>20||x.authors.some((a:any)=>!record(a,['name','id'])||!text(a.name,300)||!a.name.trim()||a.id!==undefined&&!safeId(a.id))))return fail()
 for(const key of ['deathYearHijri','publicationYearHijri'])if(x[key]!==undefined&&!int(x[key],-10000,3000))return fail()
 if(x.contemporary!==undefined&&typeof x.contemporary!=='boolean'||x.contemporary&&x.deathYearHijri!==undefined)return fail()
 if(x.volumeCount!==undefined&&!int(x.volumeCount,1,1000)||x.coverHue!==undefined&&!(typeof x.coverHue==='number'&&Number.isFinite(x.coverHue)&&x.coverHue>=0&&x.coverHue<=360)||x.coverTemplate!==undefined&&!int(x.coverTemplate,0,100))return fail()
 if(x.parts!==undefined&&(!Array.isArray(x.parts)||x.parts.length>100||x.parts.some((p:any)=>!record(p,['number','title','startPage','endPage','wordStartPage'])||!int(p.number,1,1000)||!int(p.startPage,1,1000000)||!int(p.endPage,p.startPage,1000000)||p.wordStartPage!==undefined&&!int(p.wordStartPage,1,1000000)||p.title!==undefined&&!text(p.title,300))))return fail()
 if(x.tags!==undefined&&(!Array.isArray(x.tags)||x.tags.length>100||x.tags.some((t:any)=>!record(t,['name','source','confidence','paragraphIndex','pageId'])||!text(t.name,100)||!t.name.trim()||!['toc','manual'].includes(t.source)||t.confidence!==undefined&&!(typeof t.confidence==='number'&&t.confidence>=0&&t.confidence<=1)||t.paragraphIndex!==undefined&&!int(t.paragraphIndex,0,10000000)||t.pageId!==undefined&&!int(t.pageId,0,10000000))))return fail()
 return structuredClone(x) as PublicBookMetadata
}
export interface PublicBookAsset{id:string;kind:'volume'|'pdf'|'cover';partNumber:number|null;mimeType:string;fileName:string;byteLength:number;fileUrl:string}
export function parsePublicBookAssets(value:unknown,bookId:string,primaryBytes:number):PublicBookAsset[]{
 if(value===undefined)return []
 if(!Array.isArray(value)||value.length>22)return fail()
 const seen=new Set<string>(),parts=new Set<number>(),kinds=new Set<string>();let total=primaryBytes
 const result=value.map((a:any)=>{
  if(!record(a,['id','kind','partNumber','mimeType','fileName','byteLength','fileUrl'])||typeof a.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(a.id)||seen.has(a.id)||!['volume','pdf','cover'].includes(a.kind)||!text(a.fileName,120)||!a.fileName||/[/\\%\u0000-\u001f]/.test(a.fileName)||!text(a.mimeType,150)||!int(a.byteLength,1,64*1024*1024)||a.fileUrl!==`/api/account/books/${encodeURIComponent(bookId)}/file?asset=${encodeURIComponent(a.id)}`)return fail()
  if(a.kind==='volume'){if(!int(a.partNumber,2,21)||parts.has(a.partNumber))return fail();parts.add(a.partNumber)}else{if(a.partNumber!==null||kinds.has(a.kind))return fail();kinds.add(a.kind)}
  if(a.kind==='pdf'&&a.mimeType!=='application/pdf'||a.kind==='cover'&&(!['image/png','image/jpeg','image/webp'].includes(a.mimeType)||a.byteLength>5*1024*1024))return fail()
  total+=a.byteLength;if(total>64*1024*1024)return fail();seen.add(a.id);return {...a} as PublicBookAsset
 });for(let part=2;part<2+parts.size;part++)if(!parts.has(part))return fail();return result
}

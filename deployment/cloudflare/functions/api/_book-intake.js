import {validCentralAuthorId} from './_central-author-contract.js'
import {validateWordBundle,wordBundleMetadata} from './_word-bundle.js'
const text=(v,max)=>typeof v==='string'&&v.length<=max&&!/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max
const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9:_-]{0,199}$/.test(v)
const only=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k))
export async function assetDigest(file){
 let digest
 if(typeof crypto.DigestStream==='function'){const stream=new crypto.DigestStream('SHA-256');await file.stream().pipeTo(stream);digest=await stream.digest}
 else{if(file.size>1024*1024)throw Error('streaming_digest_unavailable');digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer())}
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')
}
export function parseBookMetadata(raw){
 if(raw===null)return null
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>65536)throw Error('invalid_book_metadata')
 const x=JSON.parse(raw),strings={publisher:500,edition:300,investigator:500,description:20000,rawSourceMetadata:20000}
 if(!only(x,[...Object.keys(strings),'schemaVersion','authorId','authors','centralAuthorId','deathYearHijri','contemporary','publicationYearHijri','volumeCount','tags','coverHue','coverTemplate','parts']))throw Error('invalid_book_metadata')
 if(x.schemaVersion!==1)throw Error('invalid_book_metadata')
 for(const [k,max] of Object.entries(strings))if(x[k]!==undefined&&!text(x[k],max))throw Error('invalid_book_metadata')
 if(x.authorId!==undefined&&!safeId(x.authorId)||x.centralAuthorId!==undefined&&!validCentralAuthorId(x.centralAuthorId))throw Error('invalid_book_metadata')
 if(x.authors!==undefined&&(!Array.isArray(x.authors)||x.authors.length>20||x.authors.some(a=>!only(a,['name','id'])||!text(a.name,300)||!a.name.trim()||a.id!==undefined&&!safeId(a.id))))throw Error('invalid_book_metadata')
 for(const k of ['deathYearHijri','publicationYearHijri'])if(x[k]!==undefined&&!integer(x[k],-10000,3000))throw Error('invalid_book_metadata')
 if(x.contemporary!==undefined&&typeof x.contemporary!=='boolean'||x.contemporary&&x.deathYearHijri!==undefined&&!x.centralAuthorId)throw Error('invalid_book_metadata')
 if(x.volumeCount!==undefined&&!integer(x.volumeCount,1,1000)||x.coverHue!==undefined&&!(typeof x.coverHue==='number'&&Number.isFinite(x.coverHue)&&x.coverHue>=0&&x.coverHue<=360)||x.coverTemplate!==undefined&&!integer(x.coverTemplate,0,100))throw Error('invalid_book_metadata')
 if(x.parts!==undefined&&(!Array.isArray(x.parts)||x.parts.length>100||x.parts.some(p=>!only(p,['number','title','startPage','endPage','wordStartPage'])||!integer(p.number,1,1000)||!integer(p.startPage,1,1000000)||!integer(p.endPage,p.startPage,1000000)||p.wordStartPage!==undefined&&!integer(p.wordStartPage,1,1000000)||p.title!==undefined&&!text(p.title,300))))throw Error('invalid_book_metadata')
 if(x.tags!==undefined&&(!Array.isArray(x.tags)||x.tags.length>100||x.tags.some(t=>!only(t,['name','source','confidence','paragraphIndex','pageId'])||!text(t.name,100)||!t.name.trim()||!['toc','manual'].includes(t.source)||t.confidence!==undefined&&!(typeof t.confidence==='number'&&t.confidence>=0&&t.confidence<=1)||t.paragraphIndex!==undefined&&!integer(t.paragraphIndex,0,10000000)||t.pageId!==undefined&&!integer(t.pageId,0,10000000))))throw Error('invalid_book_metadata')
 return x
}
export async function intakeExtras(form,validateBook){
 const metadata=parseBookMetadata(form.get('metadata')),assets=[]
 const allowed=new Set(['file','title','author','category','metadata','pdfFile','coverFile','wordMapFile','wordBundle'])
 for(const key of form.keys())if(form.getAll(key).length!==1||!allowed.has(key)&&!/^volumeFile:([1-9]|1\d|20)$/.test(key))throw Error('invalid_book_metadata')
 for(let n=1;n<=20;n++){const f=form.get('volumeFile:'+n);if(f===null)continue;if(!(f instanceof File)||!f.size||n>1&&!form.has('volumeFile:'+(n-1)))throw Error('invalid_book_metadata');const mime=await validateBook(f);if(!mime)throw Error('invalid_book_type');assets.push({file:f,kind:'volume',partNumber:n+1,mime})}
 for(const kind of ['pdf','cover']){const file=form.get(kind+'File');if(file===null)continue;if(!(file instanceof File)||!file.size)throw Error('invalid_book_metadata');let mime
  if(kind==='pdf'){mime=await validateBook(file);if(mime!=='application/pdf')throw Error('invalid_book_type')}
  else{const b=new Uint8Array(await file.slice(0,12).arrayBuffer()),s=new TextDecoder().decode(b);mime=b[0]===0xff&&b[1]===0xd8&&b[2]===0xff?'image/jpeg':b[0]===137&&s.slice(1,4)==='PNG'?'image/png':s.startsWith('RIFF')&&s.slice(8,12)==='WEBP'?'image/webp':null;if(!mime||file.size>5*1024*1024)throw Error('invalid_book_type')}
  assets.push({file,kind,partNumber:null,mime})
 }
 const bundle=await validateWordBundle(form,assetDigest)
 if(bundle)assets.push(bundle)
 return {metadata,assets,...(bundle?{wordBundle:bundle.manifest}:{})}
}
export async function publicBookExtras(db,bookId){
 const row=await db.prepare('SELECT metadata_json AS metadata FROM user_book_metadata WHERE book_id=?1').bind(bookId).first()
 const result=await db.prepare('SELECT asset_id AS id,kind,part_number AS partNumber,file_name AS fileName,mime_type AS mimeType,byte_length AS byteLength FROM user_book_assets WHERE book_id=?1 ORDER BY kind,part_number,asset_id').bind(bookId).all()
 const wordBundle=await wordBundleMetadata(db,bookId)
 return {...(row?{metadata:JSON.parse(row.metadata)}:{}),...(wordBundle?{wordBundle}:{}),assets:(result.results??[]).map(a=>({...a,fileUrl:`/api/account/books/${encodeURIComponent(bookId)}/file?asset=${encodeURIComponent(a.id)}`}))}
}
export const missingIntakeSchema=error=>/no such table: (?:user_book_metadata|user_book_assets)/.test(String(error?.message??''))
export async function isCentrallyHidden(db,id){
 try{const row=await db.prepare('SELECT visibility,logically_deleted_at FROM central_book_overrides WHERE book_id=?1').bind(id).first();return Boolean(row&&(row.visibility!=='public'||row.logically_deleted_at))}catch(error){if(/no such table: central_book_overrides/.test(String(error?.message??'')))return false;throw error}
}

import type {StoredBook,WordPageMap} from './engine/library_store'
import {fingerprintBytes} from './word_import_authority'
import {validateWordCompanionPackage} from './word_companion_package'

export interface WordBundleProof {contract:'khizana-word-bundle/1';sourceSha256:string;pdfSha256:string;mapSha256:string;totalPages:number}
export interface WordBundleMetadata extends WordBundleProof {mapBytes:number;mapUrl:string}
const fail=():never=>{throw Error('invalid_word_bundle')}
export function parseWordBundleMetadata(value:unknown,id:string):WordBundleMetadata|undefined{
 if(value===undefined)return undefined
 if(!value||typeof value!=='object'||Array.isArray(value))return fail()
 const row=value as Record<string,unknown>
 if(Object.keys(row).some(k=>!['contract','sourceSha256','pdfSha256','mapSha256','totalPages','mapBytes','mapUrl'].includes(k))||row.contract!=='khizana-word-bundle/1'||['sourceSha256','pdfSha256','mapSha256'].some(k=>typeof row[k]!=='string'||!/^[a-f0-9]{64}$/.test(row[k] as string))||!Number.isSafeInteger(row.totalPages)||Number(row.totalPages)<1||Number(row.totalPages)>100000||!Number.isSafeInteger(row.mapBytes)||Number(row.mapBytes)<1||Number(row.mapBytes)>32*1024*1024||row.mapUrl!==`/api/account/books/${encodeURIComponent(id)}/file?wordMap=1`)return fail()
 return row as unknown as WordBundleMetadata
}
/** A digest binds the three files together; it is not a Microsoft signature. */
export async function verifyTransferredWordBundle(source:Uint8Array,pdf:Uint8Array,mapBytes:Uint8Array,proof:WordBundleProof,fileName:string):Promise<WordPageMap>{
 const hashes=await Promise.all([source,pdf,mapBytes].map(fingerprintBytes))
 if(hashes[0]!==proof.sourceSha256||hashes[1]!==proof.pdfSha256||hashes[2]!==proof.mapSha256)return fail()
 const map=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(mapBytes)) as WordPageMap
 if(map.totalPages!==proof.totalPages)return fail()
 await validateWordCompanionPackage({source,pdf,map,fileName})
 return map
}
export async function createWordBundleUpload(book:StoredBook):Promise<{pdfFile:File;wordMapFile:File;wordBundle:WordBundleProof}|undefined>{
 if(book.pdfEngine!=='microsoft-word-companion-v1')return undefined
 if(book.volumes?.length||!book.wordPageMap||!book.pdfData?.length||book.pdfStatus!=='ready'||!book.fileName.toLowerCase().endsWith('.docx'))return fail()
 await validateWordCompanionPackage({source:book.data,pdf:book.pdfData,map:book.wordPageMap,fileName:book.fileName})
 const map=new TextEncoder().encode(JSON.stringify(book.wordPageMap))
 if(map.length>32*1024*1024||book.data.length+book.pdfData.length+map.length>64*1024*1024)throw Error('account_book_too_large')
 const hashes=await Promise.all([book.data,book.pdfData,map].map(fingerprintBytes))
 return {pdfFile:new File([Uint8Array.from(book.pdfData)],book.pdfFileName||'reference.pdf',{type:'application/pdf'}),wordMapFile:new File([map],'pages.json',{type:'application/json'}),wordBundle:{contract:'khizana-word-bundle/1',sourceSha256:hashes[0]!,pdfSha256:hashes[1]!,mapSha256:hashes[2]!,totalPages:book.wordPageMap.totalPages}}
}

import type {StoredBook} from './engine/library_store'
import type {AccountBookSubmission} from './account_service'
import {fingerprintBytes} from './word_import_authority'
export async function accountSourceId(subject:string,bytes:Uint8Array,fileName:string):Promise<string>{
 const hashes:string[]=[]
 for(let offset=0;offset<bytes.length;offset+=1024*1024)hashes.push(await fingerprintBytes(bytes.subarray(offset,offset+1024*1024)))
 const ext=/\.[^.]+$/.exec(fileName.toLowerCase())?.[0]??''
 return 'src-'+await fingerprintBytes(new TextEncoder().encode(JSON.stringify([subject,ext,bytes.length,hashes])))
}
export async function localAccountSourceIds(book:StoredBook,subject:string):Promise<string[]>{
 const ids=[await accountSourceId(subject,book.sourceData??book.data,book.fileName)]
 for(const part of book.volumes??[])ids.push(await accountSourceId(subject,part.sourceData??part.data,part.fileName))
 if(book.pdfEngine==='microsoft-word-companion-v1'&&book.pdfData&&book.wordPageMap){
  const source=await accountSourceId(subject,book.data,book.fileName)
  const proof={contract:'khizana-word-bundle/1',sourceSha256:await fingerprintBytes(book.data),pdfSha256:await fingerprintBytes(book.pdfData),mapSha256:await fingerprintBytes(new TextEncoder().encode(JSON.stringify(book.wordPageMap))),totalPages:book.wordPageMap.totalPages}
  ids.push('src-'+await fingerprintBytes(new TextEncoder().encode(JSON.stringify([source,proof]))))
 }
 return ids
}
export interface UnifiedPrivateBook {local?:StoredBook;remote:AccountBookSubmission[]}
/** Match only cryptographic upload identities, never similar titles. */
export function mergePrivateAccountBooks(local:StoredBook[],remote:AccountBookSubmission[],identities:Map<string,string[]>):UnifiedPrivateBook[]{
 const remaining=new Map(remote.map(book=>[book.id,book]))
 const result:UnifiedPrivateBook[]=local.filter(book=>book.managedSource!=='published').map(book=>({local:book,remote:(identities.get(book.id)??[]).flatMap(id=>{const row=remaining.get(id);if(!row)return [];remaining.delete(id);return[row]})}))
 for(const book of remaining.values())result.push({remote:[book]})
 return result
}
export function accountBookStatus(book:AccountBookSubmission):string{return book.reviewStatus==='pending'?'بانتظار المراجعة':book.reviewStatus==='rejected'?'مرفوض':book.visibility==='public'?'منشور للعامة':'مقبول — خاص'}

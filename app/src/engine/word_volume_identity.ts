import type {StoredBook} from './library_store'
import {inferBookFormat} from '../book_format'
// Old cached rows lost leading zeroes and optional hyphens in Word text.
const WORD_TEXT_REVISION='word-text/20260910-numeric-soft-hyphen'
export function orderedWordVolumes(book:StoredBook){
 const volumes=[...(book.volumes??[])].sort((a,b)=>a.number-b.number)
 if(volumes.some(v=>!Number.isSafeInteger(v.number)||v.number<1||!(v.data instanceof Uint8Array)||!v.data.length)||new Set(volumes.map(v=>v.number)).size!==volumes.length)throw Error('word_volume_identity_invalid')
 return volumes
}
async function hash(data:Uint8Array){const copy=new Uint8Array(data);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',copy.buffer))].map(n=>n.toString(16).padStart(2,'0')).join('')}
export async function localSearchBookFingerprint(book:StoredBook):Promise<string>{
 if(!book.volumes||book.volumes.length<2){const source=book.originalSha256||`${book.id}:${book.fileSize}`;return inferBookFormat(book)==='word'?`${WORD_TEXT_REVISION}:${source}`:source}
 const parts=[]
 for(const v of orderedWordVolumes(book))parts.push([v.number,v.data.byteLength,await hash(v.data),v.wordPageMap??null])
 return 'word-volumes/v1:'+await hash(new TextEncoder().encode(JSON.stringify([WORD_TEXT_REVISION,parts])))
}

import {booksWithAuthorChronology} from './library_author_chronology'
import type {StoredBook} from './engine/library_store'
/** Never hide a usable local shelf behind unavailable public enrichment. */
export async function availableAuthorChronology(books:StoredBook[],enrich=booksWithAuthorChronology,waitMs=1500):Promise<StoredBook[]> {
 let timer:ReturnType<typeof setTimeout>|undefined
 try{return await Promise.race([enrich(books).catch(()=>books),new Promise<StoredBook[]>(resolve=>{timer=setTimeout(()=>resolve(books),waitMs)})])}
 finally{if(timer!==undefined)clearTimeout(timer)}
}

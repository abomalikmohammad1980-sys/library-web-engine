import {canonicalAuthorIdentity} from './author_display_names'
import {loadShamelaAuthorMetadata} from './shamela_author_metadata'
import {canonicalAuthorName,listAuthorRecords,type StoredBook} from './engine/library_store'
import {loadCentralAuthors} from './central_author_client'
import {loadAuthorChronologyOverrides} from './author_override_client'
type Author={id:string;name:string;deathYearHijri?:number|null|undefined;contemporary?:boolean|undefined}
export function attachAuthorChronology<T extends Pick<StoredBook,'author'|'authorId'|'deathYearHijri'|'contemporary'>>(books:readonly T[],authors:readonly Author[]):T[]{
 const ids=new Map<string,Author>(),names=new Map<string,Author[]>()
 for(const author of authors){ids.set(canonicalAuthorIdentity(author.id),author);const key=canonicalAuthorName(author.name),rows=names.get(key)??[];rows.push(author);names.set(key,rows)}
 return books.map(book=>{const matches=names.get(canonicalAuthorName(book.author)),author=book.authorId?ids.get(canonicalAuthorIdentity(book.authorId)):matches?.length===1?matches[0]:undefined
  if(!author)return {...book}
  const death=author.deathYearHijri
  return {...book,deathYearHijri:typeof death==='number'?death:undefined,contemporary:typeof death==='number'&&death>0&&death<10000?false:Boolean(author.contemporary)}
 })
}
export async function booksWithAuthorChronology(books:StoredBook[]):Promise<StoredBook[]>{
 // Original verified metadata remains usable offline; unavailable recent edits
 // are not a reason to discard it, nor a claim that the latest edit was loaded.
 const [local,index,overrides]=await Promise.all([listAuthorRecords(false),loadShamelaAuthorMetadata(),loadAuthorChronologyOverrides({signal:AbortSignal.timeout(1000)}).catch(()=>[])])
 const authors=new Map<string,Author>()
 for(const a of local)authors.set(canonicalAuthorIdentity(a.shamelaId??a.id),{id:a.shamelaId??a.id,name:a.name,deathYearHijri:a.deathYearHijri,contemporary:a.contemporary})
 for(const a of index.authors)authors.set(canonicalAuthorIdentity(a.authorId),{id:a.authorId,name:a.name,deathYearHijri:a.deathYearHijri,contemporary:a.contemporary})
 for(const row of overrides){const key=canonicalAuthorIdentity(row.authorId),author=authors.get(key);if(author)authors.set(key,{...author,deathYearHijri:row.deathHijri,contemporary:row.contemporary??false})}
 if(books.some(b=>b.authorId?.startsWith('central-author:')))for(let page=0;page<=10000;page++){const result=await loadCentralAuthors(page);for(const a of result.authors)authors.set(a.authorId,{id:a.authorId,name:a.displayName,deathYearHijri:a.deathYearHijri,contemporary:a.contemporary});if(!result.hasMore)break}
 const byBook=new Map<string,string>();for(const author of index.authors)for(const book of author.books)byBook.set(book.id,author.authorId)
 return attachAuthorChronology(books.map(book=>book.managedSource==='published'&&byBook.has(book.id)?{...book,authorId:canonicalAuthorIdentity(byBook.get(book.id))}:book),[...authors.values()])
}

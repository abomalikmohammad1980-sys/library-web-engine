import type {StoredBook} from './library_store'
type CompactBook=StoredBook&{extractedTextStorage?:'bok-pages-v1'}
/** Store one copy of a large, exactly reproducible derived text. Original bytes stay intact. */
export function compactBookForStorage(book:StoredBook):StoredBook {
 if(book.sourceKind!=='shamela4.1'||!book.bokPages?.length||!book.extractedText||book.extractedText.length<8_000_000)return book
 if(book.bokPages.map(page=>page.text).join('\n\n')!==book.extractedText)return book
 const compact:CompactBook={...book,extractedTextStorage:'bok-pages-v1'}
 delete compact.extractedText
 return compact
}
export function expandStoredBookText(book:StoredBook):StoredBook {
 if((book as CompactBook).extractedTextStorage!=='bok-pages-v1'||book.extractedText!=null)return book
 if(!book.bokPages?.length)throw Error('stored_book_derived_pages_missing')
 return {...book,extractedText:book.bokPages.map(page=>page.text).join('\n\n')}
}

import type {StoredBook} from './engine/library_store'
import {inferBookFormat} from './book_format'
import {hasAuthoritativeWordPageMaps} from './reader_page_authority'
export function wordConformityLabel(book:StoredBook):string|undefined{
 if(inferBookFormat(book)!=='word')return undefined
 const maps=book.volumes?.length?book.volumes.map(v=>v.wordPageMap):[book.wordPageMap]
 return book.paginationAuthority!=='user-approved-estimate'&&hasAuthoritativeWordPageMaps(maps,maps.length)
  ?'موافق لملف الوورد الأصلي':'الكتاب غير موافق لملف الوورد الأصلي'
}

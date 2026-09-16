import {currentLibraryIdentityScope,getBook} from './engine/library_store'
import {prepareLocalBookSearchIndex} from './engine/search_store'
import {headingIndex} from './engine/heading_index'
import {ensurePublishedWorkSeeded} from './published_library_seed'
import {shamelaSourceBookId} from './shamela_public_identity'

export async function prepareSearchBook(id:string,signal:AbortSignal,headingsOnly:boolean):Promise<void>{
 const identity=currentLibraryIdentityScope()
 const active=()=>{if(signal.aborted||currentLibraryIdentityScope()!==identity)throw new DOMException('Index preparation cancelled','AbortError')}
 active();let book=await getBook(id);active()
 const central=book?.sourceKind==='shamela4.1'||!!shamelaSourceBookId(id)
 // Downloading a book cannot repair the server's full-text index. Never
 // report a local extraction as successful central indexing.
 if(central&&!headingsOnly)throw Error('فهرس المتن المركزي غير جاهز لهذا الكتاب؛ يحتاج إصلاحًا من إدارة المكتبة.')
 if(!book||book.managedSource==='published'&&!book.data?.length){book=await ensurePublishedWorkSeeded(id)??book;active()}
 if(!book)throw Error('تعذّر تحميل الكتاب من مصدره.')
 if(headingsOnly){if(!(await headingIndex(book)).complete)throw Error('لم تتوفر شجرة عناوين موثقة في المصدر؛ تحتاج استكمال بيانات الكتاب.');active()}
 else await prepareLocalBookSearchIndex(id,{signal})
}

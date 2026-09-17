import {h} from './ui'
import {isCentralAuthorId} from './central_author_client'
export function validateCentralAuthorBookPage(result:any,page:number,seen:ReadonlySet<string>=new Set()):Array<{id:string;title:string}>{
 if(!result||result.page!==page||typeof result.hasMore!=='boolean'||!Array.isArray(result.books)||result.books.length>20||(result.hasMore&&!result.books.length))throw Error('invalid_author_books')
 const validated=new Set<string>();for(const book of result.books){if(!book||typeof book.id!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(book.id)||seen.has(book.id)||validated.has(book.id)||typeof book.title!=='string'||!book.title.trim()||book.title.length>300)throw Error('invalid_author_books');validated.add(book.id)}
 return result.books.map((book:any)=>({id:book.id,title:book.title}))
}
export function centralAuthorBooks(id:string,signal:AbortSignal):HTMLElement{
 const section=h('section',{class:'person-section'},h('h2',null,'كتبه المنشورة')),rows=h('div',{class:'books-grid'}),status=h('p',{role:'status'})
 section.append(rows,status);let loading=false;const seen=new Set<string>()
 async function load(page:number){
  if(loading||signal.aborted)return;loading=true;status.textContent='جارٍ تحميل الكتب…'
  try{
   if(!isCentralAuthorId(id))throw Error()
   const response=await fetch(`/api/library/central-author-books?id=${encodeURIComponent(id)}&page=${page}&limit=20`,{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])})
   if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error()
   const reader=response.body?.getReader();if(!reader)throw Error();const chunks:Uint8Array[]=[];let size=0
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw Error();chunks.push(value)}}catch(error){await reader.cancel();throw error}finally{reader.releaseLock()}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
   const books=validateCentralAuthorBookPage(result,page,seen)
   if(signal.aborted)return;for(const book of books){seen.add(book.id);rows.append(h('a',{href:'#/reader/'+encodeURIComponent('central-submission:'+book.id),class:'book-card'},book.title))}
   status.replaceChildren();if(result.hasMore){const more=h('button',{type:'button',class:'btn btn--secondary'},'تحميل كتب أخرى');more.onclick=()=>void load(page+1);status.append(more)}else if(!seen.size)status.textContent='لا توجد كتب منشورة مرتبطة بهذا المؤلف بعد.'
  }catch{if(!signal.aborted){const retry=h('button',{type:'button',class:'btn btn--secondary'},'إعادة المحاولة');retry.onclick=()=>void load(page);status.replaceChildren(h('span',null,'تعذّر تحميل الكتب المرتبطة.'),retry)}}finally{loading=false}
 }
 void load(0);return section
}

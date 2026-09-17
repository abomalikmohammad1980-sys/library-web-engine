import {json} from './_account-contract.js'
export const quoteActor="EXISTS(SELECT 1 FROM accounts WHERE subject=?2) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=?2 AND blocked=1)"
export const visibleQuote="NOT EXISTS(SELECT 1 FROM account_blocks z WHERE z.subject=q.owner_subject AND z.blocked=1) AND NOT EXISTS(SELECT 1 FROM central_book_overrides o WHERE (o.book_id=q.book_id OR o.book_id=q.source_id) AND (o.visibility<>'public' OR o.logically_deleted_at IS NOT NULL)) AND (q.source_kind<>'submitted' OR EXISTS(SELECT 1 FROM user_books b WHERE b.id=q.source_id AND b.visibility='public' AND b.review_status='approved' AND b.deleted_at IS NULL))"
export const quoteFields="q.id,q.text,q.book_id AS bookId,q.book_title AS bookTitle,q.page_index AS pageIndex,COALESCE(NULLIF(TRIM(a.display_name),''),'مستخدم') AS displayName,q.created_at AS createdAt"
export async function boundedQuoteJson(stream,max=16384){
 if(!stream)throw Error('body')
 const reader=stream.getReader(),parts=[];let size=0
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>max)throw Error('body');parts.push(part.value)}}catch(error){await reader.cancel();throw error}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
}
async function manifest(env,key){
 // The caller only supplies fixed keys or a regex-validated batch number.
 const object=await env.LIBRARY_R2?.get(key)
 if(!object)return null
 if(object.size>524288)throw Error('manifest')
 return boundedQuoteJson(object.body,524288)
}
export async function quoteSource(env,bookId,pageIndex,batch){
 if(typeof bookId!=='string'||bookId.length>200||!bookId||!/^[A-Za-z0-9:_-]+$/.test(bookId))return null
 const hidden=await env.VISITORS_DB.prepare("SELECT 1 FROM central_book_overrides WHERE book_id=?1 AND (visibility<>'public' OR logically_deleted_at IS NOT NULL)").bind(bookId).first();if(hidden)return null
 if(bookId.startsWith('central-submission:')){
  const id=bookId.slice(19);if(!id||!/^[A-Za-z0-9_-]{1,180}$/.test(id))return null
  const row=await env.VISITORS_DB.prepare("SELECT title FROM user_books WHERE id=?1 AND visibility='public' AND review_status='approved' AND deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM central_book_overrides WHERE book_id=?1 AND (visibility<>'public' OR logically_deleted_at IS NOT NULL))").bind(id).first()
  return row?{kind:'submitted',id,title:row.title}:null
 }
 if(batch!==undefined){
  if(typeof batch!=='string'||!/^batch-\d{4}$/.test(batch)||!/^\d+$/.test(bookId))return null
  const source=Number(bookId)-410000000;if(!Number.isSafeInteger(source)||source<1)return null
  const catalog=await manifest(env,'library/shamela/catalog.json')
  if(catalog?.contract!=='shamela-sqlite-pack/catalog-1'||!Array.isArray(catalog.batches)||!catalog.batches.some(b=>b.id===batch&&b.manifest===`./library/shamela/batches/${batch}/manifest.json`))return null
  const data=await manifest(env,`library/shamela/batches/${batch}/manifest.json`)
  if(data?.contract!=='shamela-sqlite-pack/manifest-1'||!Array.isArray(data.books)||data.books.length>1000)return null
  const book=data.books.find(b=>b.bookId===String(source))
  return book&&typeof book.catalog?.title==='string'&&book.catalog.title.length<=300&&Number.isSafeInteger(book.counts?.pages)&&pageIndex<book.counts.pages?{kind:'shamela',id:bookId,title:book.catalog.title}:null
 }
 const data=await manifest(env,'library/published/manifest.json')
 if(!Array.isArray(data?.works)||data.works.length>1000)return null
 const work=data.works.find(w=>w.id===bookId&&w.status==='ready'&&w.security?.verdict==='allow')
 if(!work||typeof work.title!=='string'||work.title.length>300||Number.isSafeInteger(work.wordArtifact?.totalPages)&&pageIndex>=work.wordArtifact.totalPages)return null
 return {kind:'published',id:bookId,title:work.title}
}
export async function quotePage(context,owner){
 const p=new URL(context.request.url).searchParams,page=Number(p.get('page')??0),limit=Number(p.get('limit')??20)
 if([...p.keys()].some(k=>!['page','limit'].includes(k)||p.getAll(k).length!==1)||!Number.isSafeInteger(page)||page<0||page>1000||!Number.isSafeInteger(limit)||limit<1||limit>50)return json({error:'invalid_quotes_page'},400)
 const rows=(await context.env.VISITORS_DB.prepare(`SELECT ${quoteFields} FROM public_quotes q JOIN accounts a ON a.subject=q.owner_subject WHERE ${visibleQuote} AND (?1='' OR q.owner_subject=?1) ORDER BY q.created_at DESC,q.id DESC LIMIT ?2 OFFSET ?3`).bind(owner??'',limit+1,page*limit).all()).results??[]
 return json({quotes:rows.slice(0,limit),page,hasMore:rows.length>limit},200,{'cache-control':'no-store'})
}

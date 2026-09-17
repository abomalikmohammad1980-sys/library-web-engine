const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
export function validDraftKey(bookId,sourceHash,pageId){return typeof bookId==='string'&&bookId.length>0&&bookId.length<=200&&!/[\x00-\x1f]/.test(bookId)&&hash(sourceHash)&&Number.isSafeInteger(pageId)&&pageId>=0}
export function validDraftWrite(body){return body&&hash(body.baseHash)&&typeof body.text==='string'&&body.text.length<=100000&&!body.text.includes('\0')&&Number.isSafeInteger(body.expectedRevision)&&body.expectedRevision>=0&&body.expectedRevision<Number.MAX_SAFE_INTEGER}
export async function readDraft(db,bookId,sourceHash,pageId){return db.prepare('SELECT base_hash AS baseHash,text,revision FROM bok_text_drafts WHERE book_id=?1 AND source_hash=?2 AND page_id=?3').bind(bookId,sourceHash,pageId).first()}
export async function saveDraft(db,key,body,actor){
 const {bookId,sourceHash,pageId}=key,next=body.expectedRevision+1
 // INSERT SELECT closes the race between two writers both seeing revision zero.
 const write=db.prepare(`INSERT INTO bok_text_drafts(book_id,source_hash,page_id,base_hash,text,revision,updated_by)
 SELECT ?1,?2,?3,?4,?5,?6,?7 WHERE ?8=0 OR EXISTS(SELECT 1 FROM bok_text_drafts WHERE book_id=?1 AND source_hash=?2 AND page_id=?3)
 ON CONFLICT(book_id,source_hash,page_id) DO UPDATE SET text=excluded.text,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP
 WHERE bok_text_drafts.revision=?8 AND bok_text_drafts.base_hash=?4`).bind(bookId,sourceHash,pageId,body.baseHash,body.text,next,actor,body.expectedRevision)
 const history=db.prepare(`INSERT INTO bok_text_draft_history(book_id,source_hash,page_id,base_hash,text,revision,updated_by)
 SELECT ?1,?2,?3,?4,?5,?6,?7 WHERE changes()=1`).bind(bookId,sourceHash,pageId,body.baseHash,body.text,next,actor)
 const [result]=await db.batch([write,history])
 return Number(result?.meta?.changes)===1?{baseHash:body.baseHash,text:body.text,revision:next}:null
}
export async function boundedDraftBody(request){
 const reader=request.body?.getReader();if(!reader)return null
 const chunks=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>650000){await reader.cancel();return null}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{return null}
}

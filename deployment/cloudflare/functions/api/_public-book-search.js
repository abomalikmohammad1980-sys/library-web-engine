// Kept deployment-local; parity with packages/search is covered by tests.
export function normalizePublicSearch(value){return value.replace(/[\(\[\{﴿（]\s*[0-9٠-٩۰-۹]+\s*[\)\]\}﴾）]/gu,' ').replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\p{Changes_When_Lowercased}/gu,p=>p.toLocaleLowerCase('ar')).replace(/[أإآٱ]/gu,'ا').replace(/ى/gu,'ي')}
// Sparse normalized-to-original character offsets preserve the printed text in
// query-centered snippets without loading full paragraphs in search responses.
export function publicSearchOffsets(value){
 const holes=[...value.matchAll(/[\(\[\{﴿（]\s*[0-9٠-٩۰-۹]+\s*[\)\]\}﴾）]/gu)].map(m=>[m.index,m.index+m[0].length]);let hole=0,normalized='',pending=-1,originalCharacters=0,normalizedCharacters=0;const offsets=[]
 const append=(text,position)=>{for(const character of text){if(normalizedCharacters%64===0)offsets.push(position);normalized+=character;normalizedCharacters++}}
 for(let at=0;at<value.length;){const point=String.fromCodePoint(value.codePointAt(at)),position=originalCharacters;originalCharacters++;if(holes[hole]&&at>=holes[hole][1])hole++;if(holes[hole]&&at>=holes[hole][0]){if(normalized)pending=position;at+=point.length;continue}at+=point.length
  if(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/u.test(point))continue
  if(!/[\p{L}\p{N}]/u.test(point)){if(normalized)pending=position;continue}
  if(pending>=0){append(' ',pending);pending=-1}append(point.toLocaleLowerCase('ar').replace(/[أإآٱ]/gu,'ا').replace(/ى/gu,'ي'),position)
 }
 if(normalized!==normalizePublicSearch(value))throw Error('public_search_offset_parity')
 return offsets
}
const encoder=new TextEncoder()
const leaseSql=`EXISTS(SELECT 1 FROM public_book_index_jobs j JOIN public_book_index_eligible e ON e.id=j.book_id AND e.generation=j.generation WHERE j.book_id=?1 AND j.generation=?2 AND j.lease_token=?3 AND j.state='running' AND j.lease_until>MAX(?4,unixepoch()))`
export async function preparePublicBookSearch(db,job,artifact,manifestSha256,now,env={}){
 if(!artifact||artifact.contract!=='public-book-index/1'||artifact.bookId!==job.book_id||artifact.generation!==job.generation||! /^[a-f0-9]{64}$/.test(manifestSha256)||!Array.isArray(artifact.rows)||!Array.isArray(artifact.headings)||!Number.isSafeInteger(now))throw Error('public_search_artifact_invalid')
 if(artifact.coverageMode==='pdf-native-text')throw Error('public_search_pdf_body_forbidden')
 if(artifact.coverageMode==='pdf-bookmarks-only'&&artifact.rows.length)throw Error('public_search_pdf_body_forbidden')
 const identity=[job.book_id,job.generation,job.lease_token,now]
 const rows=[...artifact.rows.map((row,i)=>({field:'body',ordinal:i,text:row.text,anchor:row})),...artifact.headings.map((row,i)=>({field:'heading',ordinal:i,text:row.value,anchor:row})),{field:'card',ordinal:0,text:artifact.title,anchor:{}},{field:'card',ordinal:1,text:artifact.author,anchor:{}}]
 if(rows.length>200002)throw Error('public_search_rows_bound')
 const prepared=rows.map(row=>{
  if(typeof row.text!=='string')throw Error('public_search_text_invalid')
  const {text:_text,value:_value,...anchor}=row.anchor
  const normalized=normalizePublicSearch(row.text),anchorJson=JSON.stringify({...anchor,_searchOffsets:publicSearchOffsets(row.text)})
  if(encoder.encode(JSON.stringify([row.field,row.ordinal,row.text,normalized,anchorJson])).length>900000)throw Error('public_search_row_bound')
  return {...row,normalized,anchorJson}
 })
 let staging=await db.prepare('SELECT * FROM public_book_search_staging WHERE book_id=?1').bind(job.book_id).first()
 if(!staging||staging.generation!==job.generation||staging.manifest_sha256!==manifestSha256){
  await db.prepare(`DELETE FROM public_book_search_receipts WHERE book_id=?1 AND ${leaseSql}`).bind(...identity).run()
  await db.prepare(`DELETE FROM public_book_search_rows WHERE book_id=?1 AND ${leaseSql}`).bind(...identity).run()
  const start=await db.prepare(`INSERT INTO public_book_search_staging(book_id,generation,manifest_sha256,next_row) SELECT ?1,?2,?5,0 WHERE ${leaseSql} ON CONFLICT(book_id) DO UPDATE SET generation=excluded.generation,manifest_sha256=excluded.manifest_sha256,next_row=0`).bind(...identity,manifestSha256).run()
  if(Number(start.meta?.changes)!==1)return false
  staging={next_row:0}
 }
 let cursor=staging.next_row,stageRows=0,stageBytes=0
 while(cursor<prepared.length&&stageRows<1000&&stageBytes<8000000){
  const batch=[];let bytes=2
  while(cursor+batch.length<prepared.length&&batch.length<100&&stageRows+batch.length<1000){const r=prepared[cursor+batch.length],value=[r.field,r.ordinal,r.text,r.normalized,r.anchorJson],size=encoder.encode(JSON.stringify(value)).length+1;if(batch.length&&bytes+size>900000)break;batch.push(value);bytes+=size}
  const result=await db.prepare(`INSERT INTO public_book_search_rows(book_id,generation,field,ordinal,text,normalized,anchor_json) SELECT ?1,?2,json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]'),json_extract(value,'$[4]') FROM json_each(?5) WHERE ${leaseSql} ON CONFLICT(book_id,generation,field,ordinal) DO UPDATE SET text=excluded.text,normalized=excluded.normalized,anchor_json=excluded.anchor_json RETURNING row_id`).bind(...identity,JSON.stringify(batch)).all()
  // D1 meta.changes includes trigger writes; RETURNING counts only owned rows.
  if(result.results?.length!==batch.length)return false
  cursor+=batch.length;stageRows+=batch.length;stageBytes+=bytes
  const progress=await db.prepare(`UPDATE public_book_search_staging SET next_row=?5 WHERE book_id=?1 AND generation=?2 AND manifest_sha256=?6 AND ${leaseSql}`).bind(...identity,cursor,manifestSha256).run()
  if(Number(progress.meta?.changes)!==1)return false
 }
 if(cursor<prepared.length)return 'pending'
 const result=await db.prepare(`INSERT INTO public_book_search_receipts(book_id,generation,manifest_sha256,row_count) SELECT ?1,?2,?5,?6 WHERE ${leaseSql} AND (SELECT COUNT(*) FROM public_book_search_rows WHERE book_id=?1 AND generation=?2)=?6 ON CONFLICT(book_id) DO UPDATE SET generation=excluded.generation,manifest_sha256=excluded.manifest_sha256,row_count=excluded.row_count`).bind(...identity,manifestSha256,prepared.length).run()
 return Number(result.meta?.changes)===1
}

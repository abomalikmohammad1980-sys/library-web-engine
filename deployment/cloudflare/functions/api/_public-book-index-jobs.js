// Internal lifecycle API, not an HTTP endpoint. Executors must verify immutable R2
// source/artifact digests and all parser bounds before committing a receipt here.
const eligible = `EXISTS(SELECT 1 FROM public_book_index_eligible e WHERE e.id=public_book_index_jobs.book_id AND e.generation=public_book_index_jobs.generation)`
const tokenOk = token => typeof token==='string' && /^[A-Za-z0-9_-]{16,128}$/.test(token)
const hashOk = value => typeof value==='string' && /^[a-f0-9]{64}$/.test(value)
// D1 meta.changes can include trigger work (epoch/FTS). Prove the intended
// fenced row matched via RETURNING instead of counting unrelated side effects.
const changed = (result,job) => result?.book_id===job.book_id
function clock(now){if(!Number.isSafeInteger(now)||now<0)throw Error('invalid_index_clock')}
function lease(job,now){clock(now);if(!job||typeof job.book_id!=='string'||!Number.isSafeInteger(job.generation)||job.generation<1||!tokenOk(job.lease_token))throw Error('invalid_index_lease')}

export async function claimPublicBookIndex(db,{token,now,leaseSeconds=60}){
 clock(now)
 if(!tokenOk(token)||!Number.isSafeInteger(leaseSeconds)||leaseSeconds<10||leaseSeconds>300)throw Error('invalid_index_lease')
 await db.prepare("UPDATE public_book_index_jobs SET state='failed',lease_token=NULL,lease_until=0,error_code='lease_retries_exhausted' WHERE state='running' AND lease_until<=?1 AND attempts>=8").bind(now).run()
 // The select and lease acquisition are one statement: concurrent workers cannot
 // claim the same revision. Failed leases retain their monotone checkpoint.
 const row=await db.prepare(`UPDATE public_book_index_jobs SET state='running',lease_token=?1,lease_until=?2,attempts=attempts+1,error_code=NULL
 WHERE book_id=(SELECT book_id FROM public_book_index_jobs WHERE attempts<8 AND ${eligible}
 AND ((state='queued' AND retry_at<=?3) OR (state='running' AND lease_until<=?3))
 ORDER BY retry_at,book_id LIMIT 1) RETURNING *`).bind(token,now+leaseSeconds,now).first()
 if(!row)return null
 const source=await db.prepare('SELECT * FROM public_book_index_eligible WHERE id=?1 AND generation=?2').bind(row.book_id,row.generation).first()
 if(!source)return null
 return {...row,source,requiredCoverage:source.mime_type==='application/pdf'?'pdf-bookmarks-only':'text-and-headings'}
}
export async function checkpointPublicBookIndex(db,job,now,next){
 lease(job,now);if(!Number.isSafeInteger(next)||next<0)throw Error('invalid_index_checkpoint')
 return changed(await db.prepare(`UPDATE public_book_index_jobs SET checkpoint=?1 WHERE book_id=?2 AND generation=?3 AND lease_token=?4 AND state='running' AND lease_until>?5 AND checkpoint<=?1 AND ${eligible} RETURNING book_id`).bind(next,job.book_id,job.generation,job.lease_token,now).first(),job)
}
export async function failPublicBookIndex(db,job,now,code,{permanent=false}={}){
 lease(job,now);if(typeof code!=='string'||!/^[a-z][a-z0-9_]{0,79}$/.test(code))throw Error('invalid_index_error')
 // Bounded exponential retry. Parser incompatibility/corruption is explicit,
 // never a ready result with zero rows. A new source revision resets attempts.
 return changed(await db.prepare(`UPDATE public_book_index_jobs SET state=CASE WHEN ?1=1 OR attempts>=8 THEN 'failed' ELSE 'queued' END,retry_at=?2+MIN(3600,30*(1<<MIN(attempts,7))),lease_token=NULL,lease_until=0,error_code=?3 WHERE book_id=?4 AND generation=?5 AND lease_token=?6 AND state='running' AND lease_until>?2 AND ${eligible} RETURNING book_id`).bind(permanent?1:0,now,code,job.book_id,job.generation,job.lease_token).first(),job)
}
export async function activatePublicBookIndex(db,job,now,receipt){
 lease(job,now)
 if(!receipt||!hashOk(receipt.manifestSha256)||!hashOk(receipt.sourceSha256)||receipt.artifactKey!==`public-book-index/v1/${receipt.manifestSha256}.json`||!/^[-A-Za-z0-9_.]{1,100}$/.test(receipt.parserVersion??'')||receipt.complete!==true||!Number.isSafeInteger(receipt.checkpoint)||receipt.checkpoint<1||!['text-and-headings','pdf-bookmarks-only'].includes(receipt.coverageMode))throw Error('invalid_index_receipt')
 // A PDF executor must never activate extracted page-body/OCR text under this
 // contract; user requested bookmarks only. Empty verified outlines are valid.
 return changed(await db.prepare(`UPDATE public_book_index_jobs SET state='ready',manifest_sha256=?1,source_sha256=?2,artifact_key=?3,parser_version=?4,coverage_mode=?5,lease_token=NULL,lease_until=0,error_code=NULL
 WHERE book_id=?6 AND generation=?7 AND lease_token=?8 AND state='running' AND lease_until>?9 AND checkpoint=?10 AND ${eligible}
 AND ?5=(SELECT CASE WHEN mime_type='application/pdf' THEN 'pdf-bookmarks-only' ELSE 'text-and-headings' END FROM public_book_index_eligible WHERE id=?6 AND generation=?7) RETURNING book_id`)
 .bind(receipt.manifestSha256,receipt.sourceSha256,receipt.artifactKey,receipt.parserVersion,receipt.coverageMode,job.book_id,job.generation,job.lease_token,now,receipt.checkpoint).first(),job)
}
export async function readPublicBookIndexReceipt(db,id){
 // Explicit safe projection: no owner, lease, source object key, private state or
 // stale artifact can escape through future public consumers of this helper.
 return db.prepare(`SELECT j.generation,j.manifest_sha256,j.artifact_key,j.parser_version,j.coverage_mode FROM public_book_index_jobs j JOIN public_book_index_eligible e ON e.id=j.book_id AND e.generation=j.generation WHERE j.book_id=?1 AND j.state='ready'`).bind(id).first()
}

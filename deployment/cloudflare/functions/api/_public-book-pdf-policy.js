// Verified classifier facts only. PDF body indexing and OCR are not enabled.
export function validatePdfClassification(value,sourceSha256){
 if(value?.contract!=='pdf-source-classification/1'||value.sourceSha256!==sourceSha256||!/^[a-f0-9]{64}$/.test(sourceSha256??'')||!/^pdfjs-[0-9.]+\/pdf-classifier-v1$/.test(value.parserVersion??''))throw Error('pdf_classification_invalid')
 const {pageCount,lowTextPages}=value
 if(!Number.isSafeInteger(pageCount)||pageCount<1||pageCount>100000||!Number.isSafeInteger(lowTextPages)||lowTextPages<0||lowTextPages>pageCount)throw Error('pdf_classification_invalid')
 const scanned=lowTextPages*5>=pageCount*4
 if(value.kind!==(scanned?'scanned':'text')||value.ocrPending!==scanned)throw Error('pdf_classification_invalid')
 return {contract:value.contract,sourceSha256,parserVersion:value.parserVersion,pageCount,lowTextPages,kind:value.kind,ocrPending:scanned}
}
export async function attestPdfClassification(db,job,now,value,sourceSha256){
 const proof=validatePdfClassification(value,sourceSha256)
 const row=await db.prepare(`UPDATE public_book_index_facts SET pdf_kind=?1,ocr_pending=?2,pdf_source_sha256=?3,pdf_generation=?4,updated_at=?5 WHERE book_id=?6 AND generation=?4 AND EXISTS(SELECT 1 FROM public_book_index_jobs j JOIN public_book_index_eligible e ON e.id=j.book_id AND e.generation=j.generation WHERE j.book_id=?6 AND j.generation=?4 AND j.lease_token=?7 AND j.state='running' AND j.lease_until>?5 AND e.mime_type='application/pdf') RETURNING book_id`).bind(proof.kind,proof.ocrPending?1:0,sourceSha256,job.generation,now,job.book_id,job.lease_token).first()
 return row?.book_id===job.book_id
}

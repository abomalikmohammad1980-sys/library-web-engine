export const PDF_TEXT_PREPARATION_V1='khizana-textual-pdf-preparation/1';
export const PDF_TEXT_AND_BOOKMARKS_V1='pdf-text-and-bookmarks/1';
export const PDF_BOOKMARK_SOURCE64_V1='khizana-pdf-bookmark-source64/1';
export function publicBookSourceLimitV1(mime,profile){
 const type=String(mime).split(';',1)[0].trim().toLowerCase();
 if(profile===undefined)return 20*1024*1024;
 if(![PDF_TEXT_PREPARATION_V1,PDF_BOOKMARK_SOURCE64_V1,PDF_TEXT_AND_BOOKMARKS_V1].includes(profile)||type!=='application/pdf')throw Error('pdf_preparation_profile');
 return 64*1024*1024;
}
export function assertPublicPdfTextPreparationGateV1(env,profile){
 if(profile!==PDF_TEXT_PREPARATION_V1||env?.PUBLIC_BOOK_PDF_TEXT_PREPARATION_V1_ENABLED!=='true')throw Error('pdf_text_preparation_closed');
}
export async function bindApprovedFailedPdfRawObservationV1({before,after,actualSourceSha256,actualBytes,deliveryPointerSha256,deliveryReceiptSha256}){
 const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 const encoded=new TextEncoder().encode(JSON.stringify(before));
 if(encoded.length>65536||JSON.stringify(before)!==JSON.stringify(after))throw Error('pdf_failed_raw_authority_changed');
 const r=before;
 if(!r||typeof r.id!=='string'||!/^src-[a-f0-9]{32}(?:[a-f0-9]{32})?$/.test(r.id)||r.mime_type!=='application/pdf'||r.visibility!=='public'||r.review_status!=='approved'||r.deleted_at!==null||!Number.isSafeInteger(r.review_version)||r.review_version<1||!Number.isSafeInteger(r.eligible_generation)||r.eligible_generation<1||r.revision_generation!==r.eligible_generation||r.job_generation!==r.eligible_generation||r.job_state!=='failed'||r.source_sha256!==null||r.manifest_sha256!==null||r.artifact_key!==null||r.linked_author_hidden!==null||r.hidden_overrides!==0||r.active_bok_releases!==0||typeof r.object_key!=='string'||!r.object_key.startsWith('private/')||!Number.isSafeInteger(actualBytes)||actualBytes<1||actualBytes>67108864||r.byte_length!==actualBytes||!sha(actualSourceSha256)||!sha(deliveryPointerSha256)||!sha(deliveryReceiptSha256))throw Error('pdf_failed_raw_authority_binding');
 const sourceObservationSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoded)),b=>b.toString(16).padStart(2,'0')).join('');
 return Object.freeze({contract:'khizana-approved-published-failed-pdf-raw-observation/1',bookId:r.id,generation:r.eligible_generation,reviewVersion:r.review_version,sourceObjectKey:r.object_key,sourceBytes:actualBytes,actualSourceSha256,currentJobState:'failed',jobSourceSha256:null,jobArtifactSha256:null,currentOriginalReady:false,sourceObservationSha256,deliveryPointerSha256,deliveryReceiptSha256,cloudWrites:0,extractionPerformed:false,independentAcceptance:false,queryAccepted:false});
}
export function assertPublicPdfSourceProfileGateV1(env,profile){
 if(profile===undefined)return;
 if(profile===PDF_TEXT_AND_BOOKMARKS_V1){if(env?.PUBLIC_BOOK_PDF_TEXT_AND_BOOKMARKS_V1_ENABLED!=='true')throw Error('pdf_text_and_bookmarks_closed');return;}
 if(profile===PDF_TEXT_PREPARATION_V1)return assertPublicPdfTextPreparationGateV1(env,profile);
 if(profile!==PDF_BOOKMARK_SOURCE64_V1||env?.PUBLIC_BOOK_PDF_BOOKMARK_SOURCE64_V1_ENABLED!=='true')throw Error('pdf_bookmark_source64_closed');
}


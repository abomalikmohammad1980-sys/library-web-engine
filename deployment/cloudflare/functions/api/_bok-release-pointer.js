import {accessHash,cookieValue} from './_access-session.js'
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
/** Internal primitive, deliberately NOT an HTTP endpoint. Verified release rows
 * must be registered by the trusted artifact pipeline, never from user JSON.
 * One SQL write validates all reviews and live authority at the linearization
 * point. No network preflight token can substitute for these predicates. */
export async function activateVerifiedBokRelease(context,{releaseId,candidateSha256,expectedGeneration,expectedReleaseId}){
 if(context.env.BOK_RELEASE_ACTIVATION_ENABLED!=='1')throw Error('bok_activation_disabled')
 if(!hash(releaseId)||!hash(candidateSha256)||!Number.isSafeInteger(expectedGeneration)||expectedGeneration<0||expectedGeneration>=Number.MAX_SAFE_INTEGER||(expectedGeneration===0?expectedReleaseId!==null:!hash(expectedReleaseId)))throw Error('bok_activation_invalid')
 const session=cookieValue(context.request,'__Host-khizana-access-session'),device=cookieValue(context.request,'__Host-khizana-device')
 if(!hash(session)||!hash(device))return false
 // Access sessions only for this initial primitive. Unsupported auth kinds fail closed.
 const sessionHash=await accessHash(session),deviceHash=await accessHash(device),db=context.env.VISITORS_DB
 const write=db.prepare(`INSERT INTO bok_release_pointer(scope,release_id,generation,updated_by)
 SELECT 'library',r.release_id,?3+1,a.subject
 FROM bok_verified_releases r
 JOIN account_access_sessions s ON s.token_hash=?5 AND s.device_id=?6 AND s.expires_at>unixepoch()
 JOIN accounts a ON a.subject=s.subject
 JOIN account_devices d ON d.owner_subject=s.subject AND d.device_id=s.device_id AND d.revoked_at IS NULL
 WHERE r.release_id=?1 AND r.candidate_sha256=?2
 AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND c.editorial=1)))
 AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE b.subject=a.subject AND b.blocked=1)
 AND json_type(r.reviews_json)='array' AND json_array_length(r.reviews_json) BETWEEN 1 AND 128 AND length(CAST(r.reviews_json AS BLOB))<=524288
 AND NOT EXISTS(SELECT 1 FROM json_each(r.reviews_json) j WHERE
   NOT EXISTS(SELECT 1 FROM bok_text_drafts t WHERE t.book_id=r.book_id AND t.source_hash=r.source_hash
    AND t.page_id=json_extract(j.value,'$.pageId') AND t.revision=json_extract(j.value,'$.revision')
    AND t.base_hash=json_extract(j.value,'$.baseHash') AND t.text=json_extract(j.value,'$.text')))
 AND (?3=0 OR EXISTS(SELECT 1 FROM bok_release_pointer p WHERE p.scope='library' AND p.generation=?3 AND p.release_id=?4))
 ON CONFLICT(scope) DO UPDATE SET release_id=excluded.release_id,generation=excluded.generation,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP
 WHERE bok_release_pointer.generation=?3 AND bok_release_pointer.release_id=?4`).bind(releaseId,candidateSha256,expectedGeneration,expectedReleaseId,sessionHash,deviceHash)
 const event=db.prepare(`INSERT INTO bok_release_activation_events(generation,release_id,previous_release_id,actor_subject)
 SELECT generation,release_id,?1,updated_by FROM bok_release_pointer WHERE scope='library' AND changes()=1`).bind(expectedReleaseId)
 const [result]=await db.batch([write,event])
 return Number(result?.meta?.changes)===1
}
/** Caller pins this single descriptor for BOTH reader and search. It must not
 * independently re-resolve one side during a reading/search operation. */
export async function readActiveBokRelease(db){
 return db.prepare(`SELECT p.generation,r.release_id AS releaseId,r.reader_manifest_sha256 AS readerManifestSha256,
 r.search_manifest_sha256 AS searchManifestSha256,r.artifact_root AS artifactRoot
 FROM bok_release_pointer p JOIN bok_verified_releases r ON r.release_id=p.release_id WHERE p.scope='library'`).first()
}

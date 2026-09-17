import {createHash} from 'node:crypto'
import {lstat,readFile,realpath} from 'node:fs/promises'
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'

// Acceptance belongs to ONE assembled release, never to a collection of
// independently green source trees or old screenshots.
export const REQUIREMENTS=Object.freeze({
 'word-roundtrip':['super-admin-a','super-admin-b','ordinary-user','mobile','slow-network','old-session'],
 'bok-publish-restore':['super-admin-a','ordinary-user','old-session'],
 'search-complete-fast':['mobile','slow-network','old-session'],
 'author-edit-persist':['super-admin-a','super-admin-b','ordinary-user'],
 'book-permissions':['super-admin-a','super-admin-b','ordinary-user'],
 'owner-device-account-merge':['ordinary-user','old-session'],
 'english-integration':['mobile','ordinary-user'],
 'seo-crawl':['anonymous'],
 'authors-places-maps':['mobile','slow-network','old-session'],
 'admin-oversight':['super-admin-a','super-admin-b','ordinary-user'],
 'public-visitor-count':['anonymous','ordinary-user','super-admin-a'],
 'html-audit-quran-navigation':['mobile','slow-network'],
 'book-cache-recovery':['old-session','slow-network','mobile'],
 'tafsir-source-verse-integrity':['mobile'],
 'migration-upgrade':['super-admin-a','ordinary-user','old-session'],
 'rollback-rehearsal':['old-session','ordinary-user'],
})
const HASH=/^[a-f0-9]{64}$/
export const BATCH_REQUIREMENTS=Object.freeze({
 'bundle-smoke':['desktop','mobile'],
 'server-regression':['super-admin-a','super-admin-b','ordinary-user'],
 'heading-data':['catalog'],
 'migration-upgrade':['super-admin-a','super-admin-b','ordinary-user'],
 'rollback-ready':['retained-release'],
})
export const digest=value=>createHash('sha256').update(value).digest('hex')
export function candidateFingerprint(candidate){return digest(JSON.stringify({version:candidate.version,components:candidate.components,previous:candidate.previous,scope:candidate.scope}))}
function requireValue(condition,message){if(!condition)throw Error(message)}
async function checkedFile(root,path){
 requireValue(typeof path==='string'&&path.length>0&&!isAbsolute(path)&&!path.includes('\0'),'gate_path_invalid')
 const base=await realpath(root),target=resolve(base,path),rel=relative(base,target)
 requireValue(rel&&!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel),'gate_path_escape')
 const info=await lstat(target);requireValue(info.isFile()&&!info.isSymbolicLink(),'gate_file_unsafe')
 const actual=await realpath(target);requireValue(actual.startsWith(base+sep),'gate_realpath_escape')
 return readFile(target)
}
async function verifiedFile(root,file){
 requireValue(file&&HASH.test(file.sha256??''),'gate_file_hash_missing')
 const bytes=await checkedFile(root,file.path)
 requireValue(digest(bytes)===file.sha256,`gate_file_changed:${file.path}`)
 return bytes
}
function fresh(value,minimum,now,label){
 const time=Date.parse(value);requireValue(Number.isFinite(time)&&time>=minimum&&time<=now,`gate_evidence_stale:${label}`)
}
export async function verifyNextRelease({root,candidate,phase='candidate',now=Date.now()}){
 requireValue(['candidate','live'].includes(phase),'gate_phase_invalid')
 requireValue(candidate?.schemaVersion===1&&typeof candidate.version==='string'&&candidate.version.trim(),'gate_candidate_invalid')
 requireValue(candidate.status==='assembled','gate_candidate_not_assembled')
 const incremental=candidate.scope?.mode==='incremental'
 if(candidate.scope)requireValue(incremental,'gate_scope_invalid')
 if(incremental){
  requireValue(candidate.scope.shipped?.length>0,'gate_batch_shipped_missing')
  // The user authorized delivery before full completion. Keep EVERY full
  // acceptance obligation explicitly open, never silently remove it.
  for(const id of Object.keys(REQUIREMENTS))requireValue(typeof candidate.scope.deferred?.[id]==='string'&&candidate.scope.deferred[id].trim().length>0,`gate_deferred_missing:${id}`)
 }
 const assembled=Date.parse(candidate.assembledAt)
 requireValue(Number.isFinite(assembled)&&assembled<=now&&now-assembled<=7*86400000,'gate_candidate_not_fresh')
 for(const key of ['code','data','helper','migrations']){
  const component=candidate.components?.[key]
  requireValue(component?.files?.length>0,`gate_component_missing:${key}`)
  const seen=new Set()
  for(const file of component.files){requireValue(!seen.has(file.path),`gate_duplicate_component_file:${key}`);seen.add(file.path);await verifiedFile(root,file)}
 }
 requireValue(HASH.test(candidate.previous?.deployFingerprint??''),'gate_previous_missing')
 await verifiedFile(root,candidate.previous.manifest)
 requireValue(candidate.fingerprint===candidateFingerprint(candidate),'gate_candidate_fingerprint_changed')
 // Gate one canonical test ledger per phase; missing or failed rows block.
 const ledger=JSON.parse((await verifiedFile(root,candidate.evidence?.[phase])).toString('utf8'))
 requireValue(ledger.candidateFingerprint===candidate.fingerprint&&ledger.phase===phase,'gate_evidence_wrong_candidate')
 requireValue(Array.isArray(ledger.results),'gate_results_missing')
 const rows=new Map()
 for(const row of ledger.results){requireValue(!rows.has(row.id),`gate_duplicate_result:${row.id}`);rows.set(row.id,row)}
 for(const [id,profiles] of Object.entries(incremental?BATCH_REQUIREMENTS:REQUIREMENTS)){
  const row=rows.get(id);requireValue(row?.status==='passed',`gate_requirement_open:${id}`)
  fresh(row.completedAt,Math.max(assembled,now-48*3600000),now,id)
  requireValue(row.candidateFingerprint===candidate.fingerprint,`gate_row_wrong_candidate:${id}`)
  requireValue(row.environment===phase,`gate_wrong_environment:${id}`)
  for(const profile of profiles)requireValue(row.profiles?.includes(profile),`gate_profile_missing:${id}:${profile}`)
  requireValue(row.artifacts?.length>0,`gate_artifacts_missing:${id}`)
  for(const artifact of row.artifacts)await verifiedFile(root,artifact)
 }
 if(incremental){
  requireValue(rows.get('rollback-ready').retainedFingerprint===candidate.previous.deployFingerprint,'gate_rollback_wrong_release')
  requireValue(typeof candidate.previous.deploymentId==='string'&&candidate.previous.deploymentId.length>0,'gate_previous_deployment_missing')
 }else{
 const rollback=rows.get('rollback-rehearsal')
 requireValue(rollback.restoredFingerprint===candidate.previous.deployFingerprint,'gate_rollback_wrong_release')
 // Performance is actual result visibility, not merely an HTTP response or
 // a warm engine microbenchmark. Keep slow-network measurements explicit.
 const search=rows.get('search-complete-fast')
 for(const query of ['الحج عرفة','الجهاد ذروة سنام']){
  const measurement=search.measurements?.find(item=>item.query===query&&item.fields==='heading,tag,category,card'&&item.device==='mobile'&&item.cache==='cold')
  requireValue(measurement&&measurement.coverageComplete===true&&measurement.missingBooks===0&&Number.isFinite(measurement.resultVisibleMs)&&measurement.resultVisibleMs>=0&&measurement.resultVisibleMs<1000,`gate_search_target_unmet:${query}`)
 }
 const admins=rows.get('admin-oversight').accountAliases
 requireValue(admins?.length===3&&new Set(admins).size===3,'gate_distinct_accounts_missing')
 }
 if(phase==='live'){
  requireValue(typeof ledger.deploymentId==='string'&&ledger.deploymentId.length>0,'gate_live_deployment_missing')
  requireValue(ledger.observedFingerprint===candidate.fingerprint,'gate_live_version_mismatch')
 }
 return{status:'passed',phase,version:candidate.version,fingerprint:candidate.fingerprint,requirements:rows.size}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
 const path=process.argv[2]??'ops/next-release-candidate.json'
 try{const candidate=JSON.parse((await checkedFile(root,path)).toString('utf8'));console.log(JSON.stringify(await verifyNextRelease({root,candidate,phase:process.argv[3]??'candidate'}),null,2))}
 catch(error){console.error(`NEXT_RELEASE_BLOCKED: ${error.message}`);process.exitCode=1}
}

import {createRecoveryTransport,readRecoveryBytes} from './snippet_recovery_transport'
import {decodeSourceCorrections,type RecoveryPin} from './snippet_source_recovery'
export type SearchRecoveryConfig={releaseId:string;sourceManifestSha256:string;baseUrl:string;manifest:RecoveryPin&{auditSha256:string;rows:number};corrections:{url:string;sha256:string;byteLength:number}}
/** Snapshot an explicit release opt-in. Invalid opt-ins are errors, not silent legacy fallback. */
export function snapshotSearchRecovery(value:unknown):SearchRecoveryConfig|undefined{
 if(value===undefined)return undefined
 const hash=/^[a-f0-9]{64}$/
 const record=value&&typeof value==='object'?value as Record<string,any>:undefined
 if(!record||typeof record.releaseId!=='string'||!record.releaseId||!hash.test(record.sourceManifestSha256??'')||typeof record.baseUrl!=='string'||!record.manifest||record.manifest.sourceManifestSha256!==record.sourceManifestSha256||!hash.test(record.manifest.sha256??'')||!hash.test(record.manifest.auditSha256??'')||!Number.isSafeInteger(record.manifest.rows)||record.manifest.rows<0||!Number.isSafeInteger(record.manifest.byteLength)||record.manifest.byteLength<1||record.manifest.byteLength>4*1024*1024||!record.corrections||typeof record.corrections.url!=='string'||!hash.test(record.corrections.sha256??'')||!Number.isSafeInteger(record.corrections.byteLength)||record.corrections.byteLength<1||record.corrections.byteLength>2*1024*1024)throw Error('shamela_recovery_optin_invalid')
 for(const address of [record.baseUrl,record.corrections.url]){const url=new URL(address);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.hash||url.search)throw Error('shamela_recovery_optin_url')}
 if(!new URL(record.baseUrl).pathname.endsWith('/'))throw Error('shamela_recovery_optin_base')
 return {releaseId:record.releaseId,sourceManifestSha256:record.sourceManifestSha256,baseUrl:record.baseUrl,manifest:{sourceManifestSha256:record.manifest.sourceManifestSha256,sha256:record.manifest.sha256,auditSha256:record.manifest.auditSha256,byteLength:record.manifest.byteLength,rows:record.manifest.rows},corrections:{url:record.corrections.url,sha256:record.corrections.sha256,byteLength:record.corrections.byteLength}}
}
export async function bindSearchRecovery(config:SearchRecoveryConfig,source:{releaseId:string;sha256:string;documents:number;positions:number},fetcher:typeof fetch,digest:(bytes:Uint8Array)=>Promise<string>){
 if(source.releaseId!==config.releaseId||source.sha256!==config.sourceManifestSha256||config.manifest.sourceManifestSha256!==source.sha256)throw Error('shamela_recovery_source_mismatch')
 const url=new URL(config.corrections.url)
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.hash)throw Error('shamela_recovery_correction_url')
 const bytes=await readRecoveryBytes(await fetcher(url,{credentials:'omit'}),config.corrections.byteLength)
 const corrections=await decodeSourceCorrections(bytes,{...config.corrections,sourceManifestSha256:source.sha256,documents:source.documents,positions:source.positions},digest)
 if(config.manifest.rows>corrections.documents)throw Error('shamela_recovery_count')
 const reader=createRecoveryTransport({baseUrl:config.baseUrl,manifest:config.manifest},{fetcher,digest})
 return {reader,excluded:corrections.excluded}
}

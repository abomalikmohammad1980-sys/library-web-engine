import {readFile,writeFile,readdir,stat} from 'node:fs/promises'
import {resolve,relative} from 'node:path'
import {digest,candidateFingerprint,REQUIREMENTS} from './next-release-gate.mjs'
const root=resolve(import.meta.dirname,'..')
const version=process.argv[2]??'batch-20260912-3',buildTarget=process.argv[3]??'app/dist-release-20260912-batch3'
if(!/^batch-\d{8}-\d+$/.test(version)||!/^app\/dist-release-\d{8}-batch\d+$/.test(buildTarget))throw Error('batch_identity_invalid')
const file=async path=>({path,sha256:digest(await readFile(resolve(root,path)))})
const walk=async path=>{const out=[];for(const item of await readdir(resolve(root,path),{withFileTypes:true})){if(item.isSymbolicLink())throw Error('unsafe_file');out.push(...(item.isDirectory()?await walk(path+'/'+item.name):[path+'/'+item.name]))}return out}
const current=JSON.parse(await readFile(resolve(root,'release-artifacts/current.json'),'utf8'))
const previous=JSON.parse(await readFile(resolve(root,'release-artifacts/previous.json'),'utf8'))
const manifest=JSON.parse(await readFile(resolve(root,'pages-dist/q13-manifest.json'),'utf8'))
if(manifest.fileCount+1>20000)throw Error('file_limit')
const components={
 code:{files:await Promise.all(['pages-dist/q13-manifest.json','wrangler.toml',...await walk('functions')].map(file))},
 data:{files:await Promise.all(manifest.files.filter(f=>/^data\/.*(?:manifest|release|snapshot).*\.json$/.test(f.path)||/^library\/published\/manifest\.json$/.test(f.path)||f.path.includes('/packed-v')).map(f=>file('pages-dist/'+f.path)))},
 helper:{files:[await file('pages-dist/downloads/khizana-word-companion-windows.zip')]},
 migrations:{files:await Promise.all((await readdir(resolve(root,'migrations'))).filter(x=>/^\d{4}_.+\.sql$/.test(x)).sort().map(x=>file('migrations/'+x)))}
}
const deferred=Object.fromEntries(Object.keys(REQUIREMENTS).map(id=>[id,'Full end-to-end acceptance remains open; see docs/design-audit/REMAINING_ONLY_20260912.md. This incremental batch does not claim closure.']))
const candidate={schemaVersion:1,version:'batch-20260912-3',status:'assembled',assembledAt:new Date().toISOString(),components,previous:{deployFingerprint:previous.fingerprint,deploymentId:'a1f88607-6f5f-4fe6-bb31-3df36224f684',manifest:await file('release-artifacts/'+previous.manifest)},scope:{mode:'incremental',shipped:['Heading partitions and 41-book supplement','Connected Word helper and account bundle storage','Author editing and precise titles','Owner account-book actions and admin UI','Reviewed English identity subset','13 source tafsir editions with verified assets','Service-worker recovery changes'],deferred},evidence:{},fingerprint:''}
// The immutable Pages tree was assembled when its final manifest was written;
// inventory/hash verification afterwards must not invalidate tests of that tree.
candidate.version=version
candidate.scope.shipped=['Previously published code, data and connected Word helper retained','Numbered chronological tafsir selector and contemporary labels','Published book card edit/delete controls and deletion-state recovery','Owner account-book bulk metadata editing','Progress-aware bounded catalog download','Verified complete source tafsir editions present in this candidate']
candidate.scope.buildTarget=buildTarget
if(version==='batch-20260913-8')candidate.scope.shipped.push('Filtered themed published-library management with bounded selection and central deletion','Nonblocking partial-result catalogue enrichment','949 reviewed English titles','188 evidence-backed supplementary tafsir anchors')
if(version==='batch-20260913-9')candidate.scope.shipped=['Batch8 tafsir and locale payloads retained byte-for-byte; new work explicitly excluded','Administrative revision reads bypass public cache for delete/edit','Complete large published text extraction and cheaper Arabic normalization','Progress-aware local indexing and rare candidate selection','Recommendation card explanation rows removed']
if(version==='batch-20260913-10')candidate.scope.shipped=['Batch9 fixes and approved library catalogue retained','Reader in-book result navigation and search-manifest retry','Unified Quran navigation, selection actions and inline audio controls','Sunnah text-search interface; draft local verdict extraction and Dorar data excluded','17 verified source tafsir editions including Zamanen, Baydawi and Razi with verified Nasafi anchors','Frozen reviewed English subset: 4541 titles and 3187 author names; Russian unchanged']
candidate.previous.deploymentId=JSON.parse(await readFile(resolve(root,'ops/batch-20260912-deployment.json'),'utf8')).deploymentId
if(version==='batch-20260914-11')candidate.scope.shipped=['Batch10 data, 17 tafsir editions, reviewed English subset and Word helper retained unchanged','Distinct verified HadeethEnc verdict summary with accessible source icon','Linked source book, exact location and author biography on one wrapping line','Whole-result source sorting, preserved paragraphs, justified display and separated footnotes']
candidate.assembledAt=(await stat(resolve(root,'pages-dist/q13-manifest.json'))).mtime.toISOString()
if(version==='batch-20260914-12')candidate.scope.shipped=['Batch11 UI retained; unrelated data, tafsir and translations frozen','Restored packed-search bootstrap before app startup and added complete 2035-book Sunnah scope with catalog provenance','Refreshed old-session scope before searching; local cached cards cannot restrict the corpus','Exact completed Sunnah counting with cached bounded pages, independent of ordinary search','Dorar live integration remains unavailable (official API 403); not claimed implemented','Cold search performance remains open; no subsecond claim']
candidate.fingerprint=candidateFingerprint(candidate)
await writeFile(resolve(root,'ops/next-release-candidate.json'),JSON.stringify(candidate,null,2)+'\n')
console.log(JSON.stringify({version:candidate.version,assembledAt:candidate.assembledAt,fingerprint:candidate.fingerprint,pagesFiles:manifest.fileCount+1,deployFingerprint:current.deployFingerprint}))

import {readFile,writeFile,stat} from 'node:fs/promises'
import {resolve} from 'node:path'
import {digest,BATCH_REQUIREMENTS,verifyNextRelease} from './next-release-gate.mjs'
const root=resolve(import.meta.dirname,'..'),candidate=JSON.parse(await readFile(resolve(root,'ops/next-release-candidate.json'),'utf8'))
const batch=process.argv[2]??'batch3'
if(!/^batch\d+$/.test(batch))throw Error('invalid_batch')
const pathFor=name=>`.artifacts/${batch}-${name}`
const artifact=async path=>({path,sha256:digest(await readFile(resolve(root,path)))})
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'))
const desktop=await read(pathFor('desktop.json')),mobile=await read(pathFor('mobile.json'))
for(const result of [desktop,mobile])if(!result.ok||!result.allApisFixture||result.target!==(candidate.scope.buildTarget??'app/dist-release-20260912-batch3')||result.results.length!==5)throw Error('browser_not_passed')
if(desktop.mobile||!mobile.mobile)throw Error('browser_profiles_missing')
const xml=await readFile(resolve(root,pathFor('server.xml')),'utf8')
if(!xml.includes('<!-- fail 0 -->')||xml.includes('<failure')||xml.includes('<error'))throw Error('server_tests_failed')
const heading=await read(pathFor('heading.json'))
if(!heading.success||heading.numPassedTests<24||heading.numFailedTests)throw Error('heading_or_source_tests_failed')
const backup=await read(pathFor('upgrade.json')),retained=await read(pathFor('retained.json'))
if(!backup.passed||!retained.passed)throw Error('upgrade_or_retained_failed')
const sources={
 'bundle-smoke':[pathFor('desktop.json'),pathFor('mobile.json')],
 'server-regression':[pathFor('server.xml')],
 'heading-data':[pathFor('heading.json')],
 'migration-upgrade':[pathFor('server.xml'),pathFor('upgrade.json')],
 'rollback-ready':[pathFor('retained.json')]
}
const results=[]
for(const [id,paths] of Object.entries(sources)){
 const times=await Promise.all(paths.map(async path=>(await stat(resolve(root,path))).mtimeMs))
 if(times.some(t=>t<Date.parse(candidate.assembledAt)))throw Error('evidence_predates_assembly:'+id)
 results.push({id,status:'passed',completedAt:new Date(Math.max(...times)).toISOString(),candidateFingerprint:candidate.fingerprint,environment:'candidate',profiles:BATCH_REQUIREMENTS[id],artifacts:await Promise.all(paths.map(artifact)),...(id==='rollback-ready'?{retainedFingerprint:retained.retainedFingerprint}:{})})
}
const path=pathFor('candidate-ledger.json')
await writeFile(resolve(root,path),JSON.stringify({phase:'candidate',candidateFingerprint:candidate.fingerprint,results},null,2)+'\n')
candidate.evidence.candidate=await artifact(path)
await writeFile(resolve(root,'ops/next-release-candidate.json'),JSON.stringify(candidate,null,2)+'\n')
console.log(JSON.stringify(await verifyNextRelease({root,candidate})))

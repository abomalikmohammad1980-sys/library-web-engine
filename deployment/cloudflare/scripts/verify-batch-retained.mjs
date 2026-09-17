import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {inventory} from './release-integrity.mjs'
const root=resolve(import.meta.dirname,'..')
const reportName=process.argv[2]??'batch-20260912-retained.json'
if(!/^[a-z0-9-]+\.json$/.test(reportName))throw Error('unsafe_report_name')
const pointer=JSON.parse(await readFile(resolve(root,'release-artifacts/previous.json'),'utf8'))
const manifest=JSON.parse(await readFile(resolve(root,'release-artifacts',pointer.manifest),'utf8'))
const actual=await inventory(resolve(root,'release-artifacts',pointer.artifact))
if(actual.fingerprint!==pointer.fingerprint||actual.fingerprint!==manifest.fingerprint)throw Error('retained_release_drift')
const receipt=JSON.parse(await readFile(resolve(root,'ops/batch-20260912-deployment.json'),'utf8'))
const result={passed:true,checkedAt:new Date().toISOString(),retainedFingerprint:actual.fingerprint,fileCount:actual.fileCount,previousDeploymentId:receipt.deploymentId}
await mkdir(resolve(root,'.artifacts'),{recursive:true})
await writeFile(resolve(root,'.artifacts',reportName),JSON.stringify(result,null,2))
console.log(JSON.stringify(result))

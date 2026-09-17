import {readFile,writeFile} from 'node:fs/promises'
import {randomBytes,createHash} from 'node:crypto'
const root='.artifacts/bok-cloud-acceptance-20260917',sha=x=>createHash('sha256').update(x).digest('hex'),session=randomBytes(32).toString('hex'),device=randomBytes(32).toString('hex')
const state=JSON.parse(await readFile(root+'/private-session.json','utf8'));state.cookie=`__Host-khizana-access-session=${session}; __Host-khizana-device=${device}`
const schema=await readFile('alpha-publish/migrations/0011_native_accounts.sql','utf8')+'\n'+await readFile('alpha-publish/migrations/0034_bok_publication_jobs.sql','utf8')
await writeFile(root+'/jobs-seed.sql',schema+`\nINSERT INTO account_devices(owner_subject,device_id,label,platform) VALUES('isolated-editor','${sha(device)}','job-test','test');
INSERT INTO account_access_sessions(token_hash,subject,device_id,expires_at) VALUES('${sha(session)}','isolated-editor','${sha(device)}',unixepoch()+900);\n`,{flag:'wx'})
await writeFile(root+'/private-job-session.json',JSON.stringify(state),{flag:'wx'})
console.log('Prepared a separate short-lived isolated job session; no production changes.')

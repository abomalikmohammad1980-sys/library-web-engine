import {readFile,writeFile,mkdir,copyFile,link} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'
import {createHash} from 'node:crypto'
const base='.artifacts/batch48',out='.artifacts/batch49',sha=b=>createHash('sha256').update(b).digest('hex')
const manifest=JSON.parse(await readFile(base+'/static-source-manifest.json')),stage=JSON.parse(await readFile(base+'/stage.json')),snapshot=JSON.parse(await readFile(base+'/source-snapshot.json'))
if(stage.payloadFingerprint!==sha(JSON.stringify(manifest)))throw Error('baseline_integrity')
await mkdir(out)
for(const entry of manifest){if(entry.path.includes('..')||entry.path.startsWith('/'))throw Error('unsafe_path');const target=resolve(out,'deploy/pages-dist',entry.path);await mkdir(dirname(target),{recursive:true});await link(resolve(base,'deploy/pages-dist',entry.path),target)}
const seen=new Set()
for(const entry of snapshot.files){if(seen.has(entry.path))continue;seen.add(entry.path);const original=await readFile(resolve(base,entry.path));if(sha(original)!==entry.sha256)throw Error('source_changed');const bytes=entry.path==='deploy/functions/api/search/batch.js'?await readFile('server/search-batch.js'):original;entry.sha256=sha(bytes);const target=resolve(out,entry.path);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'})}
for(const file of ['static-source-manifest.json','rollback.json','deploy/wrangler.jsonc'])await copyFile(base+'/'+file,out+'/'+file)
await writeFile(out+'/source-snapshot.json',JSON.stringify(snapshot,null,2),{flag:'wx'});await writeFile(out+'/stage.json',JSON.stringify({...stage,version:'batch-20260918-49'},null,2),{flag:'wx'})
console.log('batch49 prepared; static payload unchanged; server diagnostics added')

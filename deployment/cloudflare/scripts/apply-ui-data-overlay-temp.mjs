import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { materializeRuntimeFiles } from './ui-data-overlay.mjs'

const root=resolve(import.meta.dirname,'..'),source=resolve(root,'pages-dist'),target=resolve(root,'release-artifacts/temp-overlaid-candidate')
const overlay=JSON.parse(await readFile(resolve(root,process.argv[2]),'utf8'))
overlay.candidatePayloadFingerprint=JSON.parse(await readFile(resolve(root,'release-artifacts/current.json'),'utf8')).payloadFingerprint
await rm(target,{recursive:true,force:true});await cp(source,target,{recursive:true})
const replacements=materializeRuntimeFiles(overlay,await readFile(resolve(target,'index.html'),'utf8'))
for(const [path,bytes] of replacements){await mkdir(resolve(target,path,'..'),{recursive:true});await writeFile(resolve(target,path),bytes)}
await rm(resolve(target,'q13-manifest.json'))
console.log(target)

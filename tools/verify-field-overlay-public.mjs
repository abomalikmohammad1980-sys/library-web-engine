// Read-only public delivery verification. No cloud credentials or remote writes.
import {readFile,mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {planFieldOverlay,transferFieldOverlay,PIN} from './field-overlay-upload-plan.mjs'
import {journalWriter,safeFailure} from './field-overlay-upload-state.mjs'
import {readPublicFieldObject} from './field-public-read.mjs'
if(process.argv[2]!=='--verify')throw Error('explicit_verify_required')
const plan=await planFieldOverlay(),state=resolve(`.artifacts/field-overlay-transfer-${PIN}`),journal=JSON.parse(await readFile(resolve(state,'journal.json'),'utf8'))
let freshState={};try{freshState=JSON.parse(await readFile(resolve(state,'public-fresh-verification.json'),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3600000)
process.once('SIGINT',()=>controller.abort());await mkdir(state,{recursive:true})
let requests=0
const transport={get:async(key,size)=>{
 if(!key.startsWith(plan.prefix+'/')||! /^(books\/\d+\.json|manifest\.json)$/.test(key.slice(plan.prefix.length+1)))throw Error('public_verify_key')
 const bytes=await readPublicFieldObject(key,size,{prefix:plan.prefix,signal:controller.signal})
 if(++requests%100===0)console.log(JSON.stringify({publicReads:requests}))
 return bytes
}}
try{
 const result=await transferFieldOverlay({plan,journal,transport,signal:controller.signal,maxObjects:8595,maxBytes:200000000,freshVerify:true,freshState,persistFresh:value=>journalWriter(resolve(state,'public-fresh-verification.json'),value)})
 const receipt={...result,delivery:'https://khzanah.com/library/search-fields/',requests}
 await journalWriter(resolve(state,'public-status.json'),receipt);console.log(JSON.stringify(receipt))
}catch(error){await journalWriter(resolve(state,'public-failure.json'),safeFailure(error,'public_fresh_verify'));throw Error('public_field_verification_failed')}finally{clearTimeout(timer)}

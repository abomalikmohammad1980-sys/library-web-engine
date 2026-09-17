import {test} from 'node:test'
import assert from 'node:assert/strict'
import {transferFieldOverlay,validateFieldJob,PIN,PREFIX,sha} from './field-overlay-upload-plan.mjs'
import {createFieldS3Transport} from './field-overlay-s3-transport.mjs'
import {runFieldUpload,STATE} from './field-overlay-upload-cli.mjs'
import {parseR2Config,safeFailure} from './field-overlay-upload-state.mjs'
import {existsSync,statSync,readdirSync,readFileSync} from 'node:fs'
const body=Buffer.from('fixture'),job={path:'books/1.json',remoteKey:`${PREFIX}/books/1.json`,bytes:body.length,sha256:sha(body)}
function setup(){const objects=new Map(),journal={},puts=[];return{objects,journal,puts,args:{plan:{manifestSha256:PIN,prefix:PREFIX,jobs:[job],bytes:job.bytes},journal,transport:{get:async key=>objects.get(key)??null,put:async(key,value,condition)=>{assert.equal(condition.ifNoneMatch,'*');puts.push(key);objects.set(key,value)}},readLocal:async()=>body,persist:async()=>{},maxObjects:1,maxBytes:100}}}
test('bounded upload verifies readback, resumes journal, and requires fresh read for complete',async()=>{const f=setup();assert.equal((await transferFieldOverlay(f.args)).complete,false);assert.equal(f.puts.length,1);assert.equal((await transferFieldOverlay(f.args)).selectedObjects,0);assert.equal((await transferFieldOverlay({...f.args,freshVerify:true})).complete,true);f.objects.set(job.remoteKey,Buffer.from('corrupt'));await assert.rejects(()=>transferFieldOverlay({...f.args,freshVerify:true}),/immutable_remote_mismatch/)})
test('existing mismatch is never overwritten',async()=>{const f=setup();f.objects.set(job.remoteKey,Buffer.from('wrong'));await assert.rejects(()=>transferFieldOverlay(f.args),/immutable_remote_mismatch/);assert.equal(f.puts.length,0);assert.deepEqual(f.journal,{})})

test('fresh checkpoint is independent of upload journal and expires after six hours',async()=>{
 const f=setup();await transferFieldOverlay(f.args);const freshState={};let reads=0,persisted
 f.args.transport.get=async()=>{reads++;return body}
 const args={...f.args,freshVerify:true,freshState,persistFresh:async value=>{persisted=structuredClone(value)}}
 await transferFieldOverlay(args);assert.equal(reads,1);assert.equal(persisted.manifestSha256,PIN)
 await transferFieldOverlay(args);assert.equal(reads,1)
 freshState.startedAt=Date.now()-7*60*60*1000
 await transferFieldOverlay(args);assert.equal(reads,2)
})

test('fresh verification retries transient storage errors without accepting missing or corrupt data',async()=>{
 const f=setup();await transferFieldOverlay(f.args)
 let attempts=0;f.args.transport.get=async()=>{if(++attempts===1)throw Object.assign(Error('s3_http_500'),{transient:true});return body}
 assert.equal((await transferFieldOverlay({...f.args,freshVerify:true})).complete,true);assert.equal(attempts,2)
 attempts=0;f.args.transport.get=async()=>{attempts++;throw Object.assign(Error('s3_http_500'),{transient:true})}
 await assert.rejects(()=>transferFieldOverlay({...f.args,freshVerify:true}),/s3_http_500/);assert.equal(attempts,3)
})

test('fresh verification reads every object with at most two active requests and drains failures',async()=>{
 const f=setup(),jobs=Array.from({length:5},(_,i)=>({...job,path:`books/${i+1}.json`,remoteKey:`${PREFIX}/books/${i+1}.json`}))
 for(const item of jobs)f.journal[item.remoteKey]={sha256:item.sha256,bytes:item.bytes,remoteVerified:true}
 let active=0,peak=0,reads=0,corrupt=false
 const args={...f.args,plan:{...f.args.plan,jobs,bytes:jobs.length*body.length},maxObjects:5,freshVerify:true,transport:{get:async()=>{
  active++;peak=Math.max(peak,active);const ordinal=++reads
  await new Promise(resolve=>setTimeout(resolve,5));active--
  return corrupt&&ordinal===1?Buffer.from('wrong'):body
 }}}
 assert.equal((await transferFieldOverlay(args)).freshVerifiedObjects,5)
 assert.equal(reads,5);assert.equal(peak,2);assert.equal(active,0)
 corrupt=true;reads=0
 await assert.rejects(()=>transferFieldOverlay(args),/immutable_remote_mismatch/)
 assert.equal(active,0);assert.equal(reads,2)
})
test('missing readback and local corruption cannot get a receipt',async()=>{const f=setup();f.args.transport.put=async()=>{};await assert.rejects(()=>transferFieldOverlay(f.args),/immutable_remote_mismatch/);assert.deepEqual(f.journal,{});await assert.rejects(()=>transferFieldOverlay({...f.args,readLocal:async()=>Buffer.from('wrong')}),/local_sha/)})
test('keys budgets and wrong release pins failclosed before network',async()=>{assert.throws(()=>validateFieldJob({...job,path:'../secret'}),/invalid_job/);const f=setup();await assert.rejects(()=>transferFieldOverlay({...f.args,maxObjects:8596}),/limits/);await assert.rejects(()=>transferFieldOverlay({...f.args,plan:{...f.args.plan,manifestSha256:'b'.repeat(64)}}),/limits/)})
test('transport is scoped and requires conditional writes before any network',async()=>{const transport=createFieldS3Transport({endpoint:'https://'+'a'.repeat(32)+'.r2.cloudflarestorage.com',credentials:{accessKeyId:'fixture',secretAccessKey:'fixture'}});try{await assert.rejects(()=>transport.get('private/book',1),/s3_key/);await assert.rejects(()=>transport.put(job.remoteKey,body,{}),/s3_condition/);await assert.rejects(()=>transport.get(job.remoteKey,9000000),/s3_size/)}finally{transport.close()}})
test('planning success and failure do not create or mutate execution state',async()=>{
 const snapshot=()=>existsSync(STATE)?readdirSync(STATE).sort().map(name=>[name,statSync(`${STATE}/${name}`).mtimeMs]):null
 const before=snapshot(),output=[]
 await runFieldUpload(['--plan'],{planLocal:async()=>({objects:1,jobs:[job],activated:false}),log:value=>output.push(JSON.parse(value))})
 assert.deepEqual(output,[{objects:1,activated:false}]);assert.deepEqual(snapshot(),before)
 await assert.rejects(()=>runFieldUpload(['--plan'],{planLocal:async()=>{throw Error('descriptor_pin')}}),/descriptor_pin/);assert.deepEqual(snapshot(),before)
 assert.ok(readFileSync(new URL('./field-overlay-upload-cli.mjs',import.meta.url),'utf8').includes("if(process.argv[2]==='--execute')try"))
 assert.ok(STATE.startsWith('.artifacts/field-overlay-transfer-'))
})
test('credential parser is scoped to existing r2 section and diagnostics redact unknown messages',()=>{
 const value='[other]\nsecret_access_key=ignored\n[r2]\ntype=s3\nprovider=Cloudflare\nendpoint=https://'+'a'.repeat(32)+'.r2.cloudflarestorage.com\naccess_key_id=fixture-access\nsecret_access_key=fixture-secret\n'
 assert.deepEqual(parseR2Config(value).credentials,{accessKeyId:'fixture-access',secretAccessKey:'fixture-secret'})
 assert.throws(()=>parseR2Config(value+'session_token=unexpected\n'),/config_unsupported/)
 assert.throws(()=>parseR2Config(value+'[r2]\n'),/config_duplicate/)
 assert.equal(JSON.stringify(safeFailure(Error('fixture-secret'), 'transfer')).includes('fixture-secret'),false)
})

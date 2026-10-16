import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import {webcrypto} from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'

const source=await readFile(new URL('../src/index.js',import.meta.url),'utf8')
export async function loadWorker(fetchImpl=async()=>{throw Error('Unexpected provider call')}){
 const context=vm.createContext({Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,AbortController,AbortSignal,setTimeout,clearTimeout,crypto:webcrypto,console:{warn(){},error(){}},fetch:fetchImpl})
 const module=new vm.SourceTextModule(source+'\nexport { AutomaticTranslations, sourceHash, reserveQuota, localPlan, localSave, handleLocalRequest, providerOrderForPurpose, segmentTranslationMemoryKeys, writeR2TranslationMemory, cleanGeminiTranslation, splitOpenRouterSegments, splitStableTranslationMemorySegments, translationMemoryKeys, checkGeminiBudget, openRouterModelPool, translateWithGemini, translateWithGroq, translateWithMistral, translateWithCloudflareAI, translateWithDeepL, translateSegmentBatchWithDeepLRaw };',{context,identifier:new URL('../src/index.js',import.meta.url).href})
 const modules=new Map()
 async function linker(name, parent){
  if(name==='cloudflare:workers')return new vm.SyntheticModule(['DurableObject'],function(){this.setExport('DurableObject',class{})},{context})
  const url=new URL(name,parent.identifier)
  if(!modules.has(url.href))modules.set(url.href,new vm.SourceTextModule(await readFile(url,'utf8'),{context,identifier:url.href}))
  return modules.get(url.href)
 }
 await module.link(linker)
 await module.evaluate()
 return module.namespace
}
const env=()=>({TRANSLATION_CACHE:{get:async()=>null,put:async()=>{}},CF_AI_ENABLED:'false'})
const url='https://khzanah.com/api/translate'
const headers={origin:'https://khzanah.com','content-type':'application/json'}
const post=(body,extra={})=>new Request(url,{method:'POST',headers:{...headers,...extra},body})
async function response(request,customEnv=env()){
 const {default:worker}=await loadWorker()
 const r=await worker.fetch(request,customEnv)
 const text=await r.text()
 return {status:r.status,text,json:JSON.parse(text)}
}

test('source has readable UTF-8 and no repeated encoding corruption',()=>{
 assert(source.length<200000)
 assert(!/ط·آ|ط¢آ/.test(source))
 assert(source.includes('تعذر قراءة طلب الترجمة.'))
})
for(const body of ['null','[]','true','0','"text"','{'])test('rejects invalid request shape: '+body,async()=>{
 const r=await response(post(body));assert.equal(r.status,400);assert(r.text.length<200)
})
test('validates content type exactly',async()=>{
 assert.equal((await response(post('{}',{'content-type':'application/json-invalid'}))).status,415)
 assert.equal((await response(post('{}',{'content-type':'application/json; charset=UTF-8'}))).status,400)
})
test('rejects oversized bodies even without Content-Length',async()=>{
 const r=await response(post(JSON.stringify({text:'نص',targetLanguage:'en',ignored:'x'.repeat(65536)})))
 assert.equal(r.status,413);assert(r.text.length<200)
})
test('rejects oversized declared Content-Length',async()=>{
 assert.equal((await response(post('{}',{'content-length':'65537'}))).status,413)
})
test('stops a chunked body at the size limit',async()=>{
 let cancelled=false
 const body=new ReadableStream({pull(c){c.enqueue(new Uint8Array(32769))},cancel(){cancelled=true}})
 const r=await response(new Request(url,{method:'POST',headers,body,duplex:'half'}))
 assert.equal(r.status,413);assert(cancelled)
})
test('rejects malformed UTF-8 instead of translating replacement characters',async()=>{
 const r=await response(post(new Uint8Array([0x7b,0x22,0xff,0x22,0x3a,0x31,0x7d])))
 assert.equal(r.status,400)
})
test('rejects missing and foreign origins',async()=>{
 assert.equal((await response(new Request(url,{method:'POST',body:'{}',headers:{'content-type':'application/json'}}))).status,403)
 assert.equal((await response(post('{}',{origin:'https://elsewhere.invalid'}))).status,403)
 assert.equal((await response(post('{}',{'sec-fetch-site':'cross-site'}))).status,403)
})
for(const payload of [{text:'',targetLanguage:'en'},{text:'ن'.repeat(6001),targetLanguage:'en'},{text:'نص',targetLanguage:'invalid'},{text:1,targetLanguage:'en'}])test('rejects invalid text/language '+JSON.stringify(payload).slice(0,65),async()=>{
 const r=await response(post(JSON.stringify(payload)));assert.equal(r.status,400);assert(r.text.length<200)
})
test('unsupported methods return a short readable error',async()=>{
 const r=await response(new Request(url,{method:'DELETE'}));assert.equal(r.status,405);assert.equal(r.json.error,'استخدم GET للإمكانات أو POST للترجمة.')
})
test('capabilities stay v18 and do not require provider calls',async()=>{
 const r=await response(new Request(url));assert.equal(r.status,200);assert.equal(r.json.contract,'alkhizana-translation-capabilities/18')
})
test('cache hit returns translation without a provider call',async()=>{
 const e=env();e.TRANSLATION_CACHE.get=async()=> 'Peace be upon you'
 const r=await response(post(JSON.stringify({text:'السلام عليكم',targetLanguage:'en'})),e)
 assert.equal(r.status,200);assert.equal(r.json.translation,'Peace be upon you')
})
test('cache miss with unavailable providers returns controlled short 503',async()=>{
 const r=await response(post(JSON.stringify({text:'السلام عليكم',targetLanguage:'en'})))
 assert.equal(r.status,503);assert(r.text.length<2000);assert(!/ط·آ|ط¢آ/.test(r.text))
})
test('cleans Arabic and typographic quote pairs in provider replies',async()=>{
 const w=await loadWorker()
 for(const [a,b] of [['«','»'],['“','”'],['"','"']])assert.equal(w.cleanGeminiTranslation(a+'hello'+b),'hello')
 assert.equal(w.cleanGeminiTranslation('```text\nTranslation: hello\n```'),'hello')
})
test('OpenRouter segmentation preserves Arabic punctuation and full source',async()=>{
 const w=await loadWorker(),text=('هذه فقرة عربية؟ وهذه تتمتها؛ ثم فقرة أخرى.\n\n').repeat(20)
 const parts=w.splitOpenRouterSegments(text,100)
 assert(parts.length>1);assert.equal(parts.map(p=>p.text+p.joinAfter).join(''),text)
})
test('stable memory segmentation preserves paragraph separators',async()=>{
 const w=await loadWorker(),text='كلمة '.repeat(28).trim()+'\n\n'+'جملة '.repeat(28).trim()+'؟\n'+'تتمة '.repeat(28).trim()
 const parts=w.splitStableTranslationMemorySegments(text)
 assert.equal(parts.map(p=>p.source+p.joinAfter).join(''),text)
})
test('memory keys isolate target language and UI/text purpose',async()=>{
 const w=await loadWorker(),a=await w.translationMemoryKeys('نص عربي','en','ui'),b=await w.translationMemoryKeys('نص عربي','en','text'),c=await w.translationMemoryKeys('نص عربي','fr','ui')
 assert.notEqual(a.hash,b.hash);assert.notEqual(a.hash,c.hash)
 assert.equal(a.hash,(await w.translationMemoryKeys('نص  عربي','en','ui')).hash)
})
test('Gemini guard blocks exhausted budget before provider use',async()=>{
 const w=await loadWorker(),e={...env(),GEMINI_API_KEY:'test-only',TRANSLATION_CACHE:{get:async()=> '60000'}}
 await assert.rejects(w.checkGeminiBudget(e,'نص'),/guard_reached/)
 assert(w.openRouterModelPool().every(m=>m.endsWith(':free')||m==='openrouter/free'))
})
export function memoryKV(){const data=new Map();return {data,get:async key=>data.get(key)??null,put:async(key,value)=>{data.set(key,value)}}}
test('failed Gemini attempts and fallback are counted and capped',async()=>{
 let calls=0
 const w=await loadWorker(async()=>{calls++;return new Response('{}',{status:429})}),kv=memoryKV()
 const e={...env(),TRANSLATION_CACHE:kv,GEMINI_API_KEY:'test-only',GEMINI_MAX_REQUESTS_PER_DAY:'1'}
 await assert.rejects(w.translateWithGemini(e,'نص','en'),/guard_reached/)
 assert.equal(calls,1)
 assert.equal([...kv.data].find(([k])=>k.includes('daily-requests'))?.[1],'1')
 await assert.rejects(w.translateWithGemini(e,'نص','en'),/guard_reached/)
 assert.equal(calls,1)
})
for(const provider of ['Groq','Mistral'])test('failed '+provider+' calls reserve quota before retry',async()=>{
 let calls=0
 const w=await loadWorker(async()=>{calls++;return new Response('{}',{status:429})}),kv=memoryKV(),name=provider.toUpperCase()
 const e={...env(),TRANSLATION_CACHE:kv,[name+'_API_KEY']:'test-only',[name+'_MAX_REQUESTS_PER_DAY']:'1'}
 await assert.rejects(w['translateWith'+provider](e,'نص','en'))
 await assert.rejects(w['translateWith'+provider](e,'نص','en'),/guard_reached/)
 assert.equal(calls,1)
})
test('failed Cloudflare AI attempts consume the source-character guard',async()=>{
 let calls=0
 const w=await loadWorker(),kv=memoryKV(),e={...env(),TRANSLATION_CACHE:kv,CF_AI_ENABLED:'true',CF_AI_DAILY_CHAR_LIMIT:'2',AI:{run:async()=>{calls++;throw Error('Unavailable')}}}
 await assert.rejects(w.translateWithCloudflareAI(e,'نص','en'))
 await assert.rejects(w.translateWithCloudflareAI(e,'نص','en'),/guard_reached/)
 assert.equal(calls,1)
})
test('successful mocked Azure translation is cached and reused',async()=>{
 let calls=0
 const w=await loadWorker(async(url,options)=>{calls++;assert(String(url).startsWith('https://api.cognitive.microsofttranslator.com/translate?'));assert.equal(JSON.parse(options.body)[0].Text,'السلام عليكم');return Response.json([{translations:[{text:'Peace be upon you'}]}])})
 const e={...env(),TRANSLATION_CACHE:memoryKV(),AZURE_TRANSLATOR_KEY:'test-only',AZURE_TRANSLATOR_REGION:'northeurope',AZURE_TRANSLATOR_ENDPOINT:'https://api.cognitive.microsofttranslator.com'}
 for(let i=0;i<2;i++){const r=await w.default.fetch(post(JSON.stringify({text:'السلام عليكم',targetLanguage:'en'})),e);assert.equal(r.status,200);assert.equal((await r.json()).translation,'Peace be upon you')}
 assert.equal(calls,1)
})
test('coordinator joins concurrent identical requests',async()=>{
 const w=await loadWorker();let release,reads=0
 const gate=new Promise(resolve=>{release=resolve})
 const e={...env(),TRANSLATION_CACHE:{get:async()=>{reads++;await gate;return 'cached translation'},put:async()=>{}}}
 const c=new w.TranslationCoordinator({},e),payload={text:'نص',target:'en',purpose:'text',memory:await w.translationMemoryKeys('نص','en','text')}
 const first=c.resolve(payload),second=c.resolve(payload);release()
 const [a,b]=await Promise.all([first,second]);assert.equal(a.role,'leader');assert.equal(b.role,'follower');assert.equal(reads,1);assert.equal(a.value.translation,b.value.translation)
})

test('all 36 advertised languages reuse approved cached output without any provider calls',async()=>{
 const w=await loadWorker(),cap=await (await w.default.fetch(new Request(url),env())).json()
 assert.equal(cap.targetLanguages.length,36)
 for(const targetLanguage of cap.targetLanguages){
  const e=env();e.TRANSLATION_CACHE.get=async()=> 'Approved cached output'
  const r=await w.default.fetch(post(JSON.stringify({text:'عنوان كتاب جديد',targetLanguage,purpose:'ui'})),e)
  assert.equal(r.status,200,targetLanguage);assert.equal((await r.json()).translation,'Approved cached output')
 }
})

test('new book titles, author names and UI text follow the same cached translation pipeline',async()=>{
 let calls=0
 const w=await loadWorker(async(_url,options)=>{calls++;const text=JSON.parse(options.body)[0].Text;return Response.json([{translations:[{text:'Translated: '+text}]}])})
 const e={...env(),TRANSLATION_CACHE:memoryKV(),AZURE_TRANSLATOR_KEY:'test-only',AZURE_TRANSLATOR_REGION:'northeurope',AZURE_TRANSLATOR_ENDPOINT:'https://api.cognitive.microsofttranslator.com'}
 for(const [text,purpose] of [['عنوان كتاب جديد','text'],['اسم مؤلف جديد','text'],['نص واجهة جديد','ui']]){
  for(let i=0;i<2;i++){
   const r=await w.default.fetch(post(JSON.stringify({text,targetLanguage:'en',purpose})),e)
   assert.equal(r.status,200);assert.equal((await r.json()).translation,'Translated: '+text)
  }
 }
 assert.equal(calls,3)
})

for(const batch of [false,true])test('DeepL '+(batch?'batch':'whole')+' failed attempts and fallback cannot bypass its guard',async()=>{
 let calls=0
 const w=await loadWorker(async()=>{calls++;return new Response('{}',{status:403})})
 const e={...env(),TRANSLATION_CACHE:memoryKV(),DEEPL_API_KEY:'test-only',DEEPL_TOTAL_LIMIT:'2'}
 const run=()=>batch?w.translateSegmentBatchWithDeepLRaw(e,[{id:'1',source:'نص'}],'en'):w.translateWithDeepL(e,'نص','en')
 await assert.rejects(run(),/limit_reached/);assert.equal(calls,1)
 await assert.rejects(run(),/limit_reached/);assert.equal(calls,1)
})

function memoryR2() {
 const data=new Map()
 return {data,get:async key=>data.has(key)?{text:async()=>data.get(key).text,json:async()=>JSON.parse(data.get(key).text),httpMetadata:data.get(key).httpMetadata}:null,
  put:async(key,text,options)=>{
   if(options?.onlyIf?.get('If-None-Match')==='*' && data.has(key))return null
   data.set(key,{text,httpMetadata:options?.httpMetadata});return {key}
  }}
}
function localEnv(w) {
 const e={...env(),HY_MT_ENABLED:'true',LOCAL_TRANSLATION_AGENT_TOKEN:'a'.repeat(32),LOCAL_TRANSLATION_ENQUEUE_TOKEN:'b'.repeat(32),TRANSLATION_MEMORY:memoryR2(),TRANSLATION_CACHE:memoryKV()}
 const instances=new Map()
 e.LOCAL_TRANSLATION_QUEUE={getByName(name){
  if(!instances.has(name)){
   const db=new DatabaseSync(':memory:')
   const sql={exec(query,...args){const s=db.prepare(query);const rows=s.columns().length?s.all(...args):(s.run(...args),[]);return {toArray:()=>rows}}}
   instances.set(name,new w.LocalTranslationQueue({storage:{sql}},e))
  }
  return instances.get(name)
 }}
 return e
}
const localHello={model:'Hy-MT2-7B-Q4_K_M',utf8Probe:'مرحبا بالعالم'}
function localRequest(action,body,admin=false,extra={}){
 return new Request(url+'/internal/local/'+action,{method:body===undefined?'GET':'POST',
  headers:{authorization:'Bearer '+(admin?'b':'a').repeat(32),'content-type':'application/json; charset=utf-8',...extra},
  ...(body===undefined?{}:{body:JSON.stringify(body)})})
}
async function localCall(w,e,action,body,admin=false){
 const response=await w.default.fetch(localRequest(action,body,admin),e)
 return {status:response.status,...await response.json()}
}
const localJob={text:'فتح الباري شرح صحيح البخاري',targetLanguage:'en',purpose:'text',sourceType:'title'}

test('secure local routes are disabled by default and separate producer and agent scopes',async()=>{
 const w=await loadWorker(),e=localEnv(w)
 assert.equal((await localCall(w,env(),'pull',localHello)).status,404)
 assert.equal((await localCall(w,e,'enqueue',localJob)).status,401)
 assert.equal((await localCall(w,e,'pull',localHello,true)).status,401)
 assert.equal((await w.default.fetch(localRequest('pull',localHello,false,{origin:'https://khzanah.com'}),e)).status,401)
 assert.equal((await localCall(w,e,'pull',{...localHello,utf8Probe:'???'})).status,400)
 assert.equal((await localCall(w,e,'enqueue',{...localJob,text:'???'},true)).status,400)
})
test('end-to-end queue writes canonical R2, warms KV, records health and analytics once',async()=>{
 const w=await loadWorker(),e=localEnv(w),events=[]
 e.TRANSLATION_ANALYTICS={writeDataPoint:event=>events.push(event)}
 const a=await localCall(w,e,'enqueue',localJob,true),b=await localCall(w,e,'enqueue',localJob,true)
 assert.equal(a.id,b.id)
 const {job}=await localCall(w,e,'pull',localHello)
 assert.equal(job.units.length,1)
 const result={id:job.id,token:job.token,index:0,translation:'Fath al-Bari: Commentary on Sahih al-Bukhari',finishReason:'stop',latencyMs:4000}
 for(let i=0;i<2;i++)assert.equal((await localCall(w,e,'result',result)).accepted,true)
 assert.equal(events.length,1)
 assert.equal(events[0].blobs[11],'title')
 for(let i=0;i<2;i++)assert.equal((await localCall(w,e,'complete',{id:job.id,token:job.token})).completed,true)
 const memory=await w.translationMemoryKeys(localJob.text,'en','text')
 assert.equal(e.TRANSLATION_MEMORY.data.get(memory.r2Key).text,result.translation)
 assert.equal(e.TRANSLATION_CACHE.data.get(memory.kvKey),result.translation)
 assert(e.TRANSLATION_CACHE.data.has('health:translation-provider:v1:hymt2-local'))
 const status=await localCall(w,e,'status')
 assert.equal(status.completed,1);assert.equal(status.pending,0)
 assert.equal((await localCall(w,e,'enqueue',localJob,true)).cached,true)
})
test('existing legacy JSON and compact R2 translations never enqueue or get overwritten',async()=>{
 const w=await loadWorker()
 for(const legacy of [true,false]){
  const e=localEnv(w),memory=await w.translationMemoryKeys(localJob.text,'en','text')
  e.TRANSLATION_MEMORY.data.set(memory.r2Key,{text:legacy?JSON.stringify({translation:'Existing translation'}):'Existing translation',httpMetadata:{contentType:legacy?'application/json':'text/plain'}})
  const before=e.TRANSLATION_MEMORY.data.get(memory.r2Key).text
  assert.equal((await localCall(w,e,'enqueue',localJob,true)).cached,true)
  const record={translation:'A racing provider replacement'}
  assert(await w.writeR2TranslationMemory(e,memory.r2Key,record))
  assert.equal(record.translation,'Existing translation')
  assert.equal(e.TRANSLATION_MEMORY.data.get(memory.r2Key).text,before)
 }
})
test('legacy exact KV cache is migrated without inference',async()=>{
 const w=await loadWorker(),e=localEnv(w)
 const hash=Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(`v1|ar|en|text|${localJob.text}`))).toString('hex')
 e.TRANSLATION_CACHE.data.set(`tr:v1:en:text:${hash}`,'Legacy result')
 assert.equal((await localCall(w,e,'enqueue',localJob,true)).cached,true)
 assert.equal(e.TRANSLATION_MEMORY.data.size,1)
})
test('R2 read failure is not treated as a miss and write failure cannot complete a job',async()=>{
 const w=await loadWorker(),e=localEnv(w),get=e.TRANSLATION_MEMORY.get
 e.TRANSLATION_MEMORY.get=async()=>{throw Error('outage')}
 assert.equal((await localCall(w,e,'enqueue',localJob,true)).status,503)
 e.TRANSLATION_MEMORY.get=get
 await localCall(w,e,'enqueue',localJob,true)
 const {job}=await localCall(w,e,'pull',localHello)
 e.TRANSLATION_MEMORY.put=async()=>{throw Error('write outage')}
 assert.equal((await localCall(w,e,'result',{id:job.id,token:job.token,index:0,translation:'Fath al-Bari Commentary',finishReason:'stop'})).status,503)
 assert.equal((await localCall(w,e,'complete',{id:job.id,token:job.token})).status,503)
 assert.equal((await localCall(w,e,'status')).completed,0)
})
test('only missing stable segments are sent; partial results survive a new agent',async()=>{
 const w=await loadWorker(),e=localEnv(w)
 const text=('هذه فقرة من كتاب عربي وفيها كلام مفيد للقارئ. ').repeat(14).trim()
 const segments=w.splitStableTranslationMemorySegments(text)
 assert(segments.length>=3)
 const first=await w.segmentTranslationMemoryKeys(segments[0].source,'en','text')
 e.TRANSLATION_MEMORY.data.set(first.r2Key,{text:'Previously translated first segment',httpMetadata:{contentType:'text/plain'}})
 await localCall(w,e,'enqueue',{...localJob,text},true)
 const {job}=await localCall(w,e,'pull',localHello)
 assert(job.units.every(unit=>unit.index!==0))
 const next=job.units[0]
 const translated='This is a useful passage from an Arabic book, faithfully preserving its complete content for the reader. '.repeat(2)
 assert.equal((await localCall(w,e,'result',{id:job.id,token:job.token,index:next.index,translation:translated,finishReason:'stop'})).accepted,true)
 const plan=await w.localPlan({text,target:'en',purpose:'text'},e)
 assert(plan.units.find(unit=>unit.index===next.index).translation)
 assert.equal(e.TRANSLATION_MEMORY.data.get(first.r2Key).text,'Previously translated first segment')
 assert([...e.TRANSLATION_MEMORY.data.keys()].every(key=>key.includes('/segment/')))
})
test('invalid model output falls back to the existing Azure-first text route',async()=>{
 const calls=[]
 const w=await loadWorker(async(providerUrl)=>{calls.push(String(providerUrl));return Response.json([{translations:[{text:'Existing provider translation'}]}])}),e=localEnv(w)
 Object.assign(e,{AZURE_TRANSLATOR_KEY:'test-only',AZURE_TRANSLATOR_REGION:'northeurope',AZURE_TRANSLATOR_ENDPOINT:'https://api.cognitive.microsofttranslator.com'})
 await localCall(w,e,'enqueue',localJob,true)
 const {job}=await localCall(w,e,'pull',localHello)
 assert.equal((await localCall(w,e,'result',{id:job.id,token:job.token,index:0,translation:'???',finishReason:'stop'})).fallback,true)
 assert.equal((await localCall(w,e,'fail',{id:job.id,token:job.token,reason:'validation_failed'})).completed,true)
 assert.equal(calls.length,1);assert(calls[0].includes('microsofttranslator.com'))
})
test('all 14 excluded targets bypass local queue and keep the original provider order',async()=>{
 const w=await loadWorker(),e=localEnv(w)
 e.LOCAL_TRANSLATION_QUEUE={getByName(){throw Error('Excluded target reached local queue')}}
 assert.deepEqual(Array.from(w.providerOrderForPurpose('text')),['azure','deepl','gemini','groq','mistral','openrouter','cloudflare-ai'])
 assert.deepEqual(Array.from(w.providerOrderForPurpose('ui')),['deepl','azure','gemini','groq','mistral','openrouter','cloudflare-ai'])
 for(const targetLanguage of ['ckb','ku','sw','hu','ps','so','ha','sv','no','ro','bs','sq','az','uz']){
  assert.equal((await localCall(w,e,'enqueue',{...localJob,targetLanguage},true)).status,400)
  const r=await w.default.fetch(post(JSON.stringify({...localJob,targetLanguage})),e)
  assert.equal(r.status,503)
 }
})

test('online local primary precedes all external providers after a whole-memory miss',async()=>{
 const w=await loadWorker(),e=localEnv(w)
 e.HY_MT_WAIT_MS='1000'
 const memory=await w.translationMemoryKeys(localJob.text,'en','text')
 let enqueued=0
 e.LOCAL_TRANSLATION_QUEUE={getByName(){return {
  enqueue:async()=>{enqueued++;e.TRANSLATION_MEMORY.data.set(memory.r2Key,{text:'Local first',httpMetadata:{contentType:'text/plain'}});return {state:'pending'}},
  online:async()=>true,
 }}}
 const result=await w.default.fetch(post(JSON.stringify(localJob)),e)
 const value=await result.json()
 assert.equal(value.translation,'Local first');assert.equal(value.engine,'hymt2-local');assert.equal(enqueued,1)
})
test('background-only rollout leaves public requests on the existing provider route',async()=>{
 let calls=0
 const w=await loadWorker(async()=>{calls++;return Response.json([{translations:[{text:'Existing route'}]}])}),e=localEnv(w)
 Object.assign(e,{HY_MT_REQUEST_ENABLED:'false',AZURE_TRANSLATOR_KEY:'test-only',AZURE_TRANSLATOR_REGION:'northeurope',AZURE_TRANSLATOR_ENDPOINT:'https://api.cognitive.microsofttranslator.com'})
 e.LOCAL_TRANSLATION_QUEUE={getByName(){throw Error('Background-only gate must skip queue')}}
 const result=await w.default.fetch(post(JSON.stringify(localJob)),e)
 assert.equal(result.status,200);assert.equal(calls,1)
})
test('prepare rechecks R2 and a stale lease cannot submit a translation',async()=>{
 const w=await loadWorker(),e=localEnv(w)
 await localCall(w,e,'enqueue',localJob,true)
 const {job}=await localCall(w,e,'pull',localHello)
 const lease={id:job.id,token:job.token,index:0}
 assert.equal((await localCall(w,e,'prepare',lease)).needed,true)
 const memory=await w.translationMemoryKeys(localJob.text,'en','text')
 e.TRANSLATION_MEMORY.data.set(memory.r2Key,{text:'Another completed request',httpMetadata:{contentType:'text/plain'}})
 assert.equal((await localCall(w,e,'prepare',lease)).needed,false)
 assert.equal((await localCall(w,e,'result',{...lease,token:'old-lease',translation:'Wrong late value',finishReason:'stop'})).status,409)
 assert.equal(e.TRANSLATION_MEMORY.data.get(memory.r2Key).text,'Another completed request')
})

function durableLedger() {
 const data=new Map();let alarm=null
 const storage={data,get:async key=>structuredClone(data.get(key)),
  put:async(key,value)=>{data.set(key,structuredClone(value))},delete:async key=>data.delete(key),
  list:async({prefix='',limit=1000,startAfter=''}={})=>new Map([...data.entries()].filter(([k])=>k.startsWith(prefix)&&k>startAfter).sort(([a],[b])=>a<b?-1:1).slice(0,limit).map(([k,v])=>[k,structuredClone(v)])),
  transaction:async fn=>fn(storage),setAlarm:async value=>{alarm=value},getAlarm:async()=>alarm,deleteAlarm:async()=>{alarm=null}}
 return storage
}
async function automaticFixture(w,languages=['en','sw']) {
 const e=localEnv(w),storage=durableLedger(),quota=durableLedger()
 e.HY_MT_AUTOMATIC_ENABLED='true'
 let automatic=new w.AutomaticTranslations(storage,e,languages,null,async()=>{throw Error('Unexpected old batch')})
 const coordinator={automaticStatus:()=>automatic.status(),feedLocal:()=>automatic.feedLocal(),completeLocal:(p,t)=>automatic.completeLocal(p,t),reserveQuota:entries=>w.reserveQuota(quota,entries)}
 e.TRANSLATION_COORDINATOR={idFromName:name=>name,get:()=>coordinator}
 await automatic.enqueue([{source:'مرحبا بالعالم',kind:'title'}])
 await storage.put('lastDiscovery',Date.now())
 await storage.put('completedTranslations',100)
 return {e,storage,quota,get automatic(){return automatic},restart(){automatic=new w.AutomaticTranslations(storage,e,languages,null,async()=>{throw Error('Unexpected old batch')})}}
}
test('existing automatic ledger feeds local work, publishes the existing lookup format and advances old progress exactly once',async()=>{
 const w=await loadWorker(),f=await automaticFixture(w),{e,storage}=f
 const {job}=await localCall(w,e,'pull',localHello)
 assert.equal(job.target,'en');assert.equal(job.sourceType,'title')
 const body={id:job.id,token:job.token,index:0,translation:'Hello world',finishReason:'stop'}
 assert.equal((await localCall(w,e,'result',body)).accepted,true)
 for(let i=0;i<2;i++)assert.equal((await localCall(w,e,'complete',body)).completed,true)
 const hash=await w.sourceHash('مرحبا بالعالم'),key=`auto/v1/en/${hash}.json`
 assert.deepEqual(JSON.parse(e.TRANSLATION_MEMORY.data.get(key).text),{source:'مرحبا بالعالم',translation:'Hello world'})
 const lookup=await w.default.fetch(new Request(url+'/lookup',{method:'POST',headers,body:JSON.stringify({language:'en',keys:[hash]})}),e)
 assert.equal((await lookup.json()).translations[hash],'Hello world')
 const stats=await localCall(w,e,'status')
 assert.equal(stats.library.completedTranslations,101);assert.equal(stats.library.sources,1)
 assert.equal(stats.library.byLanguage.en.remaining,0);assert.equal(stats.library.byLanguage.sw.remaining,1)
 assert.equal(stats.completed,1)
 f.restart();assert.equal((await f.automatic.status()).completedTranslations,101)
 assert.equal([...storage.data.keys()].filter(k=>k.startsWith('pending/')).length,1)
})
test('automatic memory from another device completes stale pending state without inference or replacement',async()=>{
 const w=await loadWorker(),f=await automaticFixture(w),hash=await w.sourceHash('مرحبا بالعالم')
 const key=`auto/v1/en/${hash}.json`,record=JSON.stringify({source:'مرحبا بالعالم',translation:'Previously saved translation'})
 f.e.TRANSLATION_MEMORY.data.set(key,{text:record,httpMetadata:{contentType:'application/json'}})
 const {job}=await localCall(w,f.e,'pull',localHello)
 assert.equal(job,null);assert.equal(f.e.TRANSLATION_MEMORY.data.get(key).text,record)
 assert.equal((await f.automatic.status()).byLanguage.en.remaining,0)
 assert.equal((await localCall(w,f.e,'status')).completed,0)
})
test('saved automatic result survives interruption before completion and reconciles the old ledger on lease reclaim',async()=>{
 const w=await loadWorker(),f=await automaticFixture(w),{e}=f
 const {job}=await localCall(w,e,'pull',localHello)
 await localCall(w,e,'result',{id:job.id,token:job.token,index:0,translation:'Hello world',finishReason:'stop'})
 const shard=parseInt(job.id.slice(0,2),16)%4,queue=e.LOCAL_TRANSLATION_QUEUE.getByName(`hymt2:v1:${shard}`)
 queue.service.store.sql.exec('UPDATE local_jobs SET lease_until=0')
 f.restart()
 const recovered=await localCall(w,e,'pull',localHello)
 assert(recovered.job.skipped);assert.equal((await f.automatic.status()).completedTranslations,101)
 assert.equal((await localCall(w,e,'status')).completed,1)
})
test('automatic fallback retains DeepL-first batch routing and shared quota reservations, with Azure disabled',async()=>{
 const calls=[]
 const w=await loadWorker(async target=>{calls.push(String(target));return Response.json({translations:[{text:'Hello world'}]})}),f=await automaticFixture(w),{e}=f
 Object.assign(e,{AZURE_TRANSLATOR_KEY:'test-only',DEEPL_API_KEY:'test-only',DEEPL_TOTAL_LIMIT:'1000'})
 const {job}=await localCall(w,e,'pull',localHello)
 assert.equal((await localCall(w,e,'fail',{id:job.id,token:job.token,reason:'inference_failed'})).completed,true)
 assert.equal(calls.length,1);assert(calls[0].includes('deepl.com'))
 assert.equal((await f.automatic.status()).byLanguage.en.remaining,0)
 assert([...f.quota.data.keys()].some(key=>key.startsWith('quota:')))
})
test('automatic scheduler keeps unsupported targets active and defers eligible sources only while local agent is online',async()=>{
 const w=await loadWorker(),f=await automaticFixture(w),calls=[]
 f.automatic.translateBatch=async(items,target)=>{calls.push(target);return {results:items.map(row=>({...row,translation:'Hello world'}))}}
 await f.e.LOCAL_TRANSLATION_QUEUE.getByName('hymt2:v1:0').heartbeat()
 await f.automatic.run()
 assert.deepEqual(calls,['sw']);assert.equal((await f.automatic.status()).byLanguage.en.remaining,1)
 const presence=f.e.LOCAL_TRANSLATION_QUEUE.getByName('hymt2:v1:0').service.store
 presence.sql.exec('UPDATE local_presence SET last_seen=0')
 await f.automatic.run()
 assert.deepEqual(calls,['sw','en']);assert.equal((await f.automatic.status()).byLanguage.en.remaining,0)
})
test('automatic local integration is off by default and reuses reviewed author translations when enabled',async()=>{
 const w=await loadWorker(),f=await automaticFixture(w)
 f.e.HY_MT_AUTOMATIC_ENABLED='false'
 assert.equal((await localCall(w,f.e,'pull',localHello)).job,null)
 f.e.HY_MT_AUTOMATIC_ENABLED='true'
 const [key,task]=[...(await f.storage.list({prefix:'pending/'}))][0]
 task.kind='author';task.reviewed.en='Approved author spelling';await f.storage.put(key,task)
 assert.equal((await localCall(w,f.e,'pull',localHello)).job,null)
 assert.equal((await f.automatic.status()).byLanguage.en.remaining,0)
})

import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import {webcrypto} from 'node:crypto'

const source=await readFile(new URL('../src/index.js',import.meta.url),'utf8')
async function loadWorker(fetchImpl=async()=>{throw Error('Unexpected provider call')}){
 const context=vm.createContext({Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,AbortController,AbortSignal,setTimeout,clearTimeout,crypto:webcrypto,console:{warn(){},error(){}},fetch:fetchImpl})
 const module=new vm.SourceTextModule(source+'\nexport { cleanGeminiTranslation, splitOpenRouterSegments, splitStableTranslationMemorySegments, translationMemoryKeys, checkGeminiBudget, openRouterModelPool, translateWithGemini, translateWithGroq, translateWithMistral, translateWithCloudflareAI };',{context})
 await module.link(async name=>{assert.equal(name,'cloudflare:workers');return new vm.SyntheticModule(['DurableObject'],function(){this.setExport('DurableObject',class{})},{context})})
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
function memoryKV(){const data=new Map();return {data,get:async key=>data.get(key)??null,put:async(key,value)=>{data.set(key,value)}}}
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

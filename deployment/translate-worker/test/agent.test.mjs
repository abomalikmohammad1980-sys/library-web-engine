import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apiClient, fetchJson, translateUnit, verifyLlama, processJob, workerBase } from '../local-agent/client.mjs'

function llamaMock({finish='stop',tokens=30,output='Volume 12',model='Hy-MT2-7B-Q4_K_M.gguf',slots=1}={}) {
  const calls=[]
  const fetch=async(url,options={})=>{
    const path=new URL(url).pathname
    const body=options.body ? JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(options.body)) : null
    calls.push({path,body})
    if(path==='/health')return Response.json({status:'ok'})
    if(path==='/props')return Response.json({total_slots:slots,default_generation_settings:{n_ctx:2048}})
    if(path==='/v1/models')return Response.json({data:[{id:model}]})
    if(path==='/apply-template')return Response.json({prompt:body.messages[0].content})
    if(path==='/tokenize')return Response.json({tokens:Array(tokens).fill(1)})
    if(path==='/v1/chat/completions')return Response.json({choices:[{finish_reason:finish,message:{content:output}}]})
    throw Error('Unexpected URL')
  }
  return {fetch,calls}
}
test('Arabic bytes survive request encoding and generation uses the agreed settings',async()=>{
  const mock=llamaMock()
  const model=await verifyLlama(mock.fetch)
  const result=await translateUnit({text:'المجلد ١٢'},'en',model,undefined,mock.fetch)
  assert.equal(result.translation,'Volume 12')
  const body=mock.calls.find(call=>call.path==='/v1/chat/completions').body
  assert(body.messages[0].content.includes('المجلد ١٢'))
  assert.equal(body.temperature,0.7);assert.equal(body.top_p,0.6)
  assert.equal(body.top_k,20);assert.equal(body.repeat_penalty,1.05)
  assert.equal(body.max_tokens,768)
})
test('wrong model, wrong slots, oversized prompt and truncated output are rejected',async()=>{
  await assert.rejects(verifyLlama(llamaMock({model:'other.gguf'}).fetch),/wrong_model/)
  await assert.rejects(verifyLlama(llamaMock({slots:4}).fetch),/parallel_1/)
  for(const [options,error] of [[{tokens:1300},/context_limit/],[{finish:'length'},/incomplete_generation/]]) {
    const mock=llamaMock(options)
    await assert.rejects(translateUnit({text:'المجلد ١٢'},'en','Hy-MT2-7B-Q4_K_M',undefined,mock.fetch),error)
    if(options.tokens)assert(!mock.calls.some(call=>call.path==='/v1/chat/completions'))
  }
})
test('strict UTF-8 response decoding rejects corrupt bytes',async()=>{
  await assert.rejects(fetchJson('http://localhost/',{},1000,async()=>new Response(new Uint8Array([0xff]))),/encoded data/)
})
test('worker client refuses cleartext remote URLs and uses no redirects',async()=>{
  assert.throws(()=>workerBase('http://khzanah.com'),/HTTPS/)
  assert.throws(()=>workerBase('https://user:pass@khzanah.com'),/HTTPS/)
  assert(workerBase('http://127.0.0.1:8787').includes('/api/translate/internal/local/'))
  const api=apiClient('https://khzanah.com','x'.repeat(32),async(_url,options)=>{
    assert.equal(options.redirect,'error');return Response.json({ok:true})
  })
  assert.equal((await api('heartbeat',{})).ok,true)
})
const job={id:'a'.repeat(64),token:'lease',target:'en',mode:'local',units:[{index:0,text:'المجلد ١٢'}]}
test('a lost result response is retried with the same output without repeating inference',async()=>{
  const mock=llamaMock(),results=[];let retries=0
  const api=async(action,body)=>{
    if(action==='prepare')return {needed:true,unit:job.units[0]}
    if(action==='result') { results.push(body);if(!retries++)throw Error('network disconnected');return {accepted:true} }
    if(action==='complete')return {completed:true}
    throw Error('Unexpected '+action)
  }
  assert.equal((await processJob(job,api,'Hy-MT2-7B-Q4_K_M',undefined,mock.fetch)).completed,true)
  assert.equal(mock.calls.filter(call=>call.path==='/v1/chat/completions').length,1)
  assert.deepEqual(results[0],results[1])
})
test('a newly available Cloudflare result skips inference immediately before processing',async()=>{
  const mock=llamaMock()
  const api=async action=>action==='prepare'?{needed:false}:{completed:true}
  assert.equal((await processJob(job,api,'model',undefined,mock.fetch)).completed,true)
  assert.equal(mock.calls.length,0)
})
test('failed validation invokes Worker fallback; cancellation does not invoke fallback',async()=>{
  const actions=[],mock=llamaMock({output:'???'})
  const api=async(action)=>{actions.push(action);return action==='prepare'?{needed:true,unit:job.units[0]}:{completed:true}}
  await processJob(job,api,'model',undefined,mock.fetch)
  assert.deepEqual(actions,['prepare','fail'])
  actions.length=0
  await assert.rejects(processJob(job,api,'model',AbortSignal.abort(),mock.fetch))
  assert.equal(actions.length,0)
})

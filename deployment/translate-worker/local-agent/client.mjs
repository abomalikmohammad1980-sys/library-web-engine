import { HY_MT_LANGUAGES, HY_MT_MODEL, UTF8_PROBE, validateLocalTranslation } from '../src/local-policy.mjs'

export function workerBase(value) {
  const url = new URL(value)
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname)))) {
    throw Error('Worker URL must use HTTPS (HTTP is allowed only on localhost).')
  }
  url.pathname = '/api/translate/internal/local/'
  return url.href
}
export async function fetchJson(url, options = {}, timeout = 30000, fetchImpl = fetch) {
  const signal = options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout)
  const response = await fetchImpl(url,{...options,signal,redirect:'error'})
  const reader = response.body?.getReader()
  if (!reader) throw Error('empty_http_response')
  const chunks=[]; let size=0
  try {
    for (;;) {
      const {value,done}=await reader.read()
      if (done) break
      size+=value.length
      if (size>1024*1024) { await reader.cancel(); throw Error('oversized_http_response') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))
  if (!response.ok) {
    const error=Error(`HTTP ${response.status}: ${String(data.error || 'request_failed').slice(0,100)}`)
    error.status=response.status
    throw error
  }
  return data
}
export function apiClient(base, token, fetchImpl=fetch) {
  if (typeof token!=='string' || token.length<32) throw Error('Agent token is missing or too short.')
  const root=workerBase(base)
  return async (action,body,signal,timeout=30000)=>fetchJson(new URL(action,root),{
    method:body===undefined ? 'GET' : 'POST',
    headers:{authorization:`Bearer ${token}`,'content-type':'application/json; charset=utf-8'},
    ...(body===undefined ? {} : {body:Buffer.from(JSON.stringify(body),'utf8')}),signal,
  },timeout,fetchImpl)
}
export async function verifyLlama(fetchImpl=fetch) {
  const root='http://127.0.0.1:8080'
  const health=await fetchJson(`${root}/health`,{},10000,fetchImpl)
  if (health.status!=='ok') throw Error('llama_not_ready')
  const models=await fetchJson(`${root}/v1/models`,{},10000,fetchImpl)
  const model=models.data?.[0]?.id
  if (typeof model!=='string' || !/Hy-MT2-7B-Q4_K_M(?:\.gguf)?$/i.test(model.replaceAll('\\','/'))) throw Error('wrong_model')
  const props=await fetchJson(`${root}/props`,{},10000,fetchImpl)
  if (props.total_slots!==1 || props.default_generation_settings?.n_ctx!==2048) throw Error('llama_settings_must_be_context_2048_parallel_1')
  return model
}
export async function translateUnit(unit,target,model,signal,fetchImpl=fetch) {
  if (!Object.hasOwn(HY_MT_LANGUAGES,target)) throw Error('unsupported_language')
  const root='http://127.0.0.1:8080'
  const messages=[{role:'user',content:`Translate the following Arabic text into ${HY_MT_LANGUAGES[target]} faithfully. Preserve the full text, proper names and numbers. Output only the translation without explanation:\n\n${unit.text}`}]
  const post=(path,body)=>fetchJson(`${root}${path}`,{
    method:'POST',headers:{'content-type':'application/json; charset=utf-8'},
    body:Buffer.from(JSON.stringify(body),'utf8'),signal,
  },120000,fetchImpl)
  // Count the actual rendered chat template, not characters or an approximate ratio.
  const template=await post('/apply-template',{messages,add_generation_prompt:true})
  if (typeof template.prompt!=='string') throw Error('template_unavailable')
  const tokenized=await post('/tokenize',{content:template.prompt,add_special:true})
  if (!Array.isArray(tokenized.tokens) || tokenized.tokens.length>1200) throw Error('context_limit')
  const started=Date.now()
  const result=await post('/v1/chat/completions',{
    model,messages,temperature:0.7,top_p:0.6,top_k:20,repeat_penalty:1.05,
    max_tokens:Math.min(768,2048-tokenized.tokens.length-64),stream:false,
  })
  const choice=result.choices?.[0]
  const translation=choice?.message?.content
  const validation=validateLocalTranslation(unit.text,translation,target,choice?.finish_reason || 'unknown')
  if (validation) throw Error(validation==='incomplete_generation' ? validation : 'validation_failed')
  return {translation,finishReason:choice.finish_reason,latencyMs:Date.now()-started}
}
export const hello = {model:HY_MT_MODEL,utf8Probe:UTF8_PROBE}

export async function processJob(job, api, model, signal, fetchImpl=fetch, onUnit=()=>{}) {
  const lease={id:job.id,token:job.token}
  if (job.mode==='fallback') return api('fail',{...lease,reason:'inference_failed'},signal,180000)
  for (const unit of job.units) {
    if (signal?.aborted) throw signal.reason
    const prepared=await api('prepare',{...lease,index:unit.index},signal)
    if (!prepared.needed) continue
    onUnit(unit)
    let result
    try { result=await translateUnit(prepared.unit,job.target,model,signal,fetchImpl) }
    catch(error) {
      if (signal?.aborted) throw error
      return api('fail',{...lease,reason:error.message},signal,180000)
    }
    // Retry the same result on a transient network error; never infer again here.
    let accepted
    for (let attempt=0;attempt<3;attempt++) {
      try { accepted=await api('result',{...lease,index:unit.index,...result},signal); break }
      catch(error) {
        if (error.status===409 || (error.status>=400 && error.status<500) || attempt===2 || signal?.aborted) throw error
      }
    }
    if (!accepted.accepted) return api('fail',{...lease,reason:'validation_failed'},signal,180000)
  }
  return api('complete',lease,signal)
}

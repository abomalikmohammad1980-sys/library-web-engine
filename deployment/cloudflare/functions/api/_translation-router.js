import {translateAlibaba} from './_translation-alibaba.js'
// Arabic -> target routing policy. A priority is a benchmark hypothesis, not a measured score.
// Unsupported or unverified pairs are never sent to a provider.
const codes = ['en','fr','tr','ur','ug','ckb','ku','fa','sw','hi','hu','id','ms','bn','ps','so','ha','ru','uk','de','es','pt','it','nl','sv','no','pl','ro','bs','sq','az','uz','kk','zh','ja','ko']
const aws = new Set('en fr tr ur fa sw hi hu id ms bn ps so ha ru uk de es pt it nl sv no pl ro bs sq az uz kk zh ja ko'.split(' '))
const qwen = new Set('en fr tr ur fa sw hi hu id ms bn ru uk de es pt it nl sv no pl ro bs sq az uz kk zh ja ko'.split(' '))
// Alibaba's published core-pair list, rather than its wider code list, confirms Arabic pairs.
const alibaba = new Set('en fr tr ru de es pt it pl id zh ja ko'.split(' '))
export const LANGUAGE_ROUTES = Object.fromEntries(codes.map(code => {
  const priority = ['azure', 'google']
  if (qwen.has(code)) priority.push('qwen')
  if (aws.has(code)) priority.push('aws')
  if (alibaba.has(code)) priority.push('alibaba')
  priority.push('workers-ai')
  return [code, { codes: { azure: code === 'ckb' ? 'ku' : code === 'ku' ? 'kmr' : code === 'no' ? 'nb' : code === 'zh' ? 'zh-Hans' : code, google: code, qwen: code === 'no' ? 'nb' : code, aws: code, alibaba: code }, priority }]
}))

const LIMITS = { azure: 2_000_000, google: 500_000, alibaba: 1_000_000, aws: 2_000_000, qwen: 1_000_000 }
const secretReady = (env, provider) => ({
  azure: !!env.AZURE_TRANSLATOR_KEY,
  google: !!env.GOOGLE_TRANSLATE_KEY,
  qwen: !!(env.QWEN_API_KEY && env.QWEN_ENDPOINT),
  aws: !!(env.AWS_TRANSLATE_ACCESS_KEY_ID && env.AWS_TRANSLATE_SECRET_ACCESS_KEY && env.AWS_TRANSLATE_REGION),
  alibaba: !!(env.ALIBABA_TRANSLATE_ACCESS_KEY_ID && env.ALIBABA_TRANSLATE_ACCESS_KEY_SECRET),
})[provider]
const isoMonth = now => now.toISOString().slice(0, 7)
const validUntil = (value, now) => /^\d{4}-\d\d-\d\d$/.test(value || '') && now < new Date(`${value}T00:00:00Z`)
const cap = (env, provider, now) => {
  if (provider === 'aws' && !validUntil(env.AWS_TRANSLATE_FREE_UNTIL, now)) return 0
  if (provider === 'qwen' && !validUntil(env.QWEN_FREE_UNTIL, now)) return 0
  const configured = env[`TRANSLATION_${provider.toUpperCase()}_FREE_CHARS`]
  const value = configured === undefined ? LIMITS[provider] : Number(configured)
  return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, LIMITS[provider]) : 0
}

// One atomic statement. Missing table/DB fails closed; reservation is never refunded after an
// ambiguous network failure because the remote provider may have billed that request.
export async function reserveQuota(db, provider, period, amount, limit) {
  if (!limit || amount > limit || amount <= 0 || !db?.prepare) return false
  const row = await db.prepare(`INSERT INTO translation_provider_usage(bucket, used, expires_at)
    VALUES(?1,?2,?4) ON CONFLICT(bucket) DO UPDATE SET used=used+excluded.used
    WHERE used <= ?3-excluded.used RETURNING used`)
    .bind(`${provider}:${period}`, amount, limit, Math.floor(Date.now() / 1000) + 45 * 86400).first()
  return !!row
}

// Separate free period per provider. Qwen counts tokens, conservatively reserved as UTF-8
// bytes * 3 (input and expected output); this avoids claiming precision before API usage arrives.
export async function routeTranslation({ env, text, target, purpose, now = new Date(), adapters = PROVIDERS }) {
  const policy = LANGUAGE_ROUTES[target]
  if (!policy) throw new Error('unsupported_language')
  if (!env.VISITORS_DB?.prepare) throw new Error('translation_quota_store_unavailable')
  let lastError
  for (const provider of policy.priority) {
    if (provider === 'workers-ai') break
    if (!secretReady(env, provider) || !adapters[provider] || (provider === 'alibaba' && text.length > 5000)) continue
    const limit = cap(env, provider, now)
    const amount = provider === 'qwen' ? new TextEncoder().encode(text).length * 3 : text.length
    if (!await reserveQuota(env.VISITORS_DB, provider, isoMonth(now), amount, limit)) continue
    try {
      const translation = await adapters[provider]({ env, text, target: policy.codes[provider], purpose })
      if (typeof translation !== 'string' || !translation.trim()) throw new Error('empty_translation')
      return { translation: translation.trim(), provider }
    } catch (error) {
      lastError = error
      console.warn('translation_provider_failed', provider, error instanceof Error ? error.message.slice(0, 120) : 'unknown')
    }
  }
  const error = new Error('translation_external_unavailable')
  error.cause = lastError
  throw error
}

async function postJson(url, init, pick) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error(`provider_http_${response.status}`)
  const payload = await response.json()
  const translation = pick(payload)
  if (typeof translation !== 'string' || !translation.trim()) throw new Error('provider_empty_response')
  return translation
}

const encode = new TextEncoder()
async function sha256(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? encode.encode(value) : value)), x => x.toString(16).padStart(2, '0')).join('')
}
async function hmac(key, value, format = 'raw') {
  const imported = await crypto.subtle.importKey('raw', typeof key === 'string' ? encode.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signed = await crypto.subtle.sign('HMAC', imported, encode.encode(value))
  return format === 'hex' ? Array.from(new Uint8Array(signed), x => x.toString(16).padStart(2, '0')).join('') : signed
}

export const PROVIDERS = {
  alibaba: translateAlibaba,
  azure: ({ env, text, target }) => postJson(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=ar&to=${encodeURIComponent(target)}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'ocp-apim-subscription-key': env.AZURE_TRANSLATOR_KEY, ...(env.AZURE_TRANSLATOR_REGION ? { 'ocp-apim-subscription-region': env.AZURE_TRANSLATOR_REGION } : {}) }, body: JSON.stringify([{ Text: text }]),
  }, data => data?.[0]?.translations?.[0]?.text),
  google: ({ env, text, target }) => postJson(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(env.GOOGLE_TRANSLATE_KEY)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: text, source: 'ar', target, format: 'text' }),
  }, data => data?.data?.translations?.[0]?.translatedText),
  qwen: ({ env, text, target }) => {
    const endpoint = new URL(env.QWEN_ENDPOINT)
    if (endpoint.protocol !== 'https:' || !/(^|\.)aliyuncs\.com$/.test(endpoint.hostname) || !endpoint.pathname.endsWith('/chat/completions')) throw new Error('invalid_qwen_endpoint')
    return postJson(endpoint.href, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.QWEN_API_KEY}` }, body: JSON.stringify({ model: 'qwen-mt-plus', messages: [{ role: 'user', content: text }], translation_options: { source_lang: 'ar', target_lang: target } }) }, data => data?.choices?.[0]?.message?.content)
  },
  aws: async ({ env, text, target }) => {
    const region = env.AWS_TRANSLATE_REGION
    if (!/^[a-z]{2}-[a-z]+-\d$/.test(region)) throw new Error('invalid_aws_region')
    const host = `translate.${region}.amazonaws.com`, body = JSON.stringify({ Text: text, SourceLanguageCode: 'ar', TargetLanguageCode: target })
    const time = new Date(), stamp = time.toISOString().replace(/[:-]|\.\d{3}/g, ''), day = stamp.slice(0, 8)
    const headers = { 'content-type': 'application/x-amz-json-1.1', host, 'x-amz-date': stamp, 'x-amz-target': 'AWSShineFrontendService_20170701.TranslateText' }
    if (env.AWS_TRANSLATE_SESSION_TOKEN) headers['x-amz-security-token'] = env.AWS_TRANSLATE_SESSION_TOKEN
    const names = Object.keys(headers).sort(), signed = names.join(';'), canonical = names.map(name => `${name}:${headers[name].trim()}\n`).join('')
    const scope = `${day}/${region}/translate/aws4_request`
    const request = `POST\n/\n\n${canonical}\n${signed}\n${await sha256(body)}`
    const string = `AWS4-HMAC-SHA256\n${stamp}\n${scope}\n${await sha256(request)}`
    const dateKey = await hmac(`AWS4${env.AWS_TRANSLATE_SECRET_ACCESS_KEY}`, day)
    const regionKey = await hmac(dateKey, region), serviceKey = await hmac(regionKey, 'translate')
    const signature = await hmac(await hmac(serviceKey, 'aws4_request'), string, 'hex')
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${env.AWS_TRANSLATE_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signed}, Signature=${signature}`
    return postJson(`https://${host}/`, { method: 'POST', headers, body }, data => data?.TranslatedText)
  },
}

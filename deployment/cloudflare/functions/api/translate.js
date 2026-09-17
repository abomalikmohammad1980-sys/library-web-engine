const LANGUAGES = new Set(['en','fr','tr','ur','ug','ckb','ku','fa','sw','hi','hu','id','ms','bn','ps','so','ha','ru','uk','de','es','pt','it','nl','sv','no','pl','ro','bs','sq','az','uz','kk','zh','ja','ko'])
import {translationBody,translationLimited} from './_translation-guard.js'
// M2M100 does not expose stable target codes for both Kurdish variants on
// Workers AI, so route them through the multilingual prompt instead.
const SPECIAL_LLM_LANGUAGES = new Set(['ug','ckb','ku'])
const MODEL_TIMEOUT_MS = 12_000

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cross-origin-resource-policy': 'same-origin',
  },
})

function isSameOriginRequest(request) {
  if ((request.headers.get('sec-fetch-site') || '').toLowerCase() === 'cross-site') return false
  const origin = request.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).origin === new URL(request.url).origin } catch { return false }
}

function isQuotaError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return /quota|rate.?limit|usage.?limit|exceed|too many requests|daily limit/i.test(message)
}

async function boundedRun(ai, model, input, timeoutMs = MODEL_TIMEOUT_MS) {
  let timeout
  try {
    return await Promise.race([
      ai.run(model, input),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('translation_model_timeout')), timeoutMs) }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}

async function translateWithLlm(ai, text, target, purpose) {
  const answer = await boundedRun(ai, '@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: `Translate faithfully from Arabic into language code ${target}. ${purpose === 'ui' ? 'The input is a short library-app interface label, book title, or author name; use concise natural interface language and transliterate proper names instead of changing their identity.' : 'Preserve paragraph breaks, quotations, Quran verse markers, names, numbers, and citations.'} Output only the translation. Never add explanations.` },
      { role: 'user', content: text },
    ],
    temperature: 0,
    max_tokens: 4096,
  })
  const translation = typeof answer?.response === 'string' ? answer.response.trim() : ''
  if (!translation) throw new Error('empty translation')
  return translation
}

export async function onRequestPost(context) {
  if (!context.request.headers.get('origin') || !isSameOriginRequest(context.request)) return json({ error: 'cross_origin_forbidden' }, 403)
  if (!context.env.AI) return json({ code: 'translation_not_configured', error: 'خدمة الترجمة غير مفعلة على هذا الإصدار.' }, 503)
  if (!(context.request.headers.get('content-type') || '').toLowerCase().includes('application/json')) return json({ error: 'صيغة الطلب غير صحيحة.' }, 415)
  let body
  try { body = await translationBody(context.request) } catch(error) { return json({ error: 'تعذر قراءة طلب الترجمة.' }, error.message==='translation_body_too_large'?413:400) }
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const target = typeof body.targetLanguage === 'string' ? body.targetLanguage : ''
  const purpose = body.purpose === 'ui' ? 'ui' : 'text'
  if (!text || text.length > 6000) return json({ error: 'يجب أن يكون النص بين 1 و6000 محرف.' }, 400)
  if (!LANGUAGES.has(target)) return json({ error: 'اللغة المطلوبة غير مدعومة.' }, 400)
  try {
    const retry=await translationLimited(context,purpose)
    if(retry){const response=json({code:'translation_rate_limited',error:'بلغت حد طلبات الترجمة؛ حاول لاحقًا.'},429);response.headers.set('retry-after',String(retry));return response}
  }catch{return json({code:'translation_temporarily_unavailable',error:'خدمة الترجمة غير متاحة مؤقتًا.'},503)}
  try {
    if (purpose === 'ui' || SPECIAL_LLM_LANGUAGES.has(target)) {
      const translation = await translateWithLlm(context.env.AI, text, target, purpose)
      return json({ translation, engine: 'multilingual-review', reviewed: false })
    }
    try {
      const answer = await boundedRun(context.env.AI, '@cf/meta/m2m100-1.2b', { text, source_lang: 'ar', target_lang: target })
      const translation = typeof answer?.translated_text === 'string' ? answer.translated_text.trim() : ''
      if (!translation) throw new Error('empty translation')
      return json({ translation, engine: 'm2m100', reviewed: false })
    } catch (primaryError) {
      if (isQuotaError(primaryError)) throw primaryError
      console.warn('translation_primary_failed', primaryError instanceof Error ? primaryError.message : String(primaryError))
      const translation = await translateWithLlm(context.env.AI, text, target, purpose)
      return json({ translation, engine: 'multilingual-fallback', reviewed: false })
    }
  } catch (error) {
    console.error('translation_failed', error instanceof Error ? error.message : String(error))
    if (isQuotaError(error)) return json({ code: 'translation_quota_exhausted', error: 'نفدت حصة خدمة الترجمة مؤقتًا.' }, 429)
    return json({ error: 'تعذرت الترجمة الآن؛ حاول مرة أخرى بعد قليل.' }, 502)
  }
}

export const onRequestGet = ({ request }) => isSameOriginRequest(request)
  ? json({ contract: 'alkhizana-translation-capabilities/1', sourceLanguages: ['ar'], targetLanguages: [...LANGUAGES].sort(), maxTextCharacters: 6000 })
  : json({ error: 'cross_origin_forbidden' }, 403)

export const onRequest = () => json({ error: 'استخدم GET للإمكانات أو POST للترجمة.' }, 405)

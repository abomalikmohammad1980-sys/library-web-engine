const MODEL = 'gemini-3.5-flash-lite'
const API_ROOT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`
const MAX_OUTPUT_TOKENS = 4096

export function geminiSystemInstruction(target, purpose) {
  return `Translate the Arabic source faithfully and literally into language code ${target}. ${purpose === 'ui'
    ? 'The input is a short library-app interface label, book title, or author name; use concise natural interface language and transliterate proper names instead of changing their identity.'
    : 'Preserve paragraph breaks, quotations, Quran verse markers, names, numbers, and citations.'} Preserve every detail and all punctuation. Do not omit, summarize, explain, replace, or add content. Return only the translation, with no notes or alternatives.`
}

function maxOutputTokensFor(text) {
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(64, Math.ceil(Array.from(text).length * 2)))
}

async function postGemini(env, action, body) {
  const response = await fetch(`${API_ROOT}:${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`gemini_http_${response.status}`)
  return response.json()
}

function requestContent(text) {
  return [{ role: 'user', parts: [{ text }] }]
}

export async function countGeminiInputTokens({ env, text, target, purpose }) {
  const payload = await postGemini(env, 'countTokens', {
    generateContentRequest: {
      systemInstruction: { parts: [{ text: geminiSystemInstruction(target, purpose) }] },
      contents: requestContent(text),
    },
  })
  if (!Number.isSafeInteger(payload?.totalTokens) || payload.totalTokens < 0) {
    throw new Error('gemini_token_count_missing')
  }
  return payload.totalTokens
}

export async function translateGemini({ env, text, target, purpose, maxOutputTokens }) {
  const payload = await postGemini(env, 'generateContent', {
    systemInstruction: { parts: [{ text: geminiSystemInstruction(target, purpose) }] },
    contents: requestContent(text),
    generationConfig: { maxOutputTokens },
  })
  const candidate = payload?.candidates?.[0]
  const translation = candidate?.content?.parts?.map(part => part?.text || '').join('').trim() || ''
  const totalTokens = payload?.usageMetadata?.totalTokenCount
  if (!translation) throw new Error('gemini_empty_translation')
  if (candidate?.finishReason === 'MAX_TOKENS') throw new Error('gemini_output_truncated')
  if (!Number.isSafeInteger(totalTokens) || totalTokens < 0) throw new Error('gemini_usage_metadata_missing')
  return { translation, totalTokens }
}

export { maxOutputTokensFor }

// Deliberate intersection of the project's 36 targets and Tencent's model card.
// Adding model languages here requires a separate project language-policy change.
export const HY_MT_LANGUAGES = Object.freeze({
  en: 'English', fr: 'French', tr: 'Turkish', ur: 'Urdu', ug: 'Uyghur',
  fa: 'Persian', hi: 'Hindi', id: 'Indonesian', ms: 'Malay', bn: 'Bengali',
  ru: 'Russian', uk: 'Ukrainian', de: 'German', es: 'Spanish', pt: 'Portuguese',
  it: 'Italian', nl: 'Dutch', pl: 'Polish', kk: 'Kazakh', zh: 'Simplified Chinese',
  ja: 'Japanese', ko: 'Korean',
})
export const HY_MT_MODEL = 'Hy-MT2-7B-Q4_K_M'
export const HY_MT_PROVIDER = 'hymt2-local'
export const LOCAL_SHARDS = 4
export const LOCAL_PREFIX = '/api/translate/internal/local/'
export const UTF8_PROBE = 'مرحبا بالعالم'
export function localEnabled(env) {
  return env.HY_MT_ENABLED === 'true' && Boolean(env.LOCAL_TRANSLATION_QUEUE && env.TRANSLATION_MEMORY && env.TRANSLATION_CACHE)
}
export function validSource(text) {
  return typeof text === 'string' && text.trim().length > 0 && text.length <= 6000 &&
    new TextDecoder().decode(new TextEncoder().encode(text)) === text && !/\uFFFD|\?{3,}/u.test(text)
}
function digits(text) {
  return (text.replace(/[٠-٩]/g, c => String(c.charCodeAt(0)-1632))
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0)-1776)).match(/\d+/g) || []).sort()
}
export function validateLocalTranslation(source, output, target, finishReason = 'stop') {
  if (!HY_MT_LANGUAGES[target]) return 'unsupported_language'
  if (!validSource(source)) return 'invalid_source_utf8'
  if (finishReason !== 'stop') return 'incomplete_generation'
  if (typeof output !== 'string' || !output.trim() || output.length > 24000) return 'empty_or_oversized'
  if (new TextDecoder().decode(new TextEncoder().encode(output)) !== output ||
      /\uFFFD|\?{3,}|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(output)) return 'corrupt_utf8'
  if (/```|<\/?think>|^(?:translation|here is|note:|الترجمة\s*:)/iu.test(output.trim())) return 'extra_explanation'
  const a = [...source.replace(/\s/gu, '')].length, b = [...output.replace(/\s/gu, '')].length
  if (a > 30 && b < a * (['zh','ja','ko'].includes(target) ? 0.12 : 0.25)) return 'too_short'
  if (b > Math.max(160, a*8)) return 'too_long'
  const words=output.trim().split(/\s+/u), phrases=new Map()
  for(let i=0;i+6<=words.length;i++) {
    const phrase=words.slice(i,i+6).join(' ')
    const repeats=(phrases.get(phrase)||0)+1
    if (repeats>=4) return 'repetition'
    phrases.set(phrase,repeats)
  }
  if (/(\S+)(?:\s+\1){5,}/iu.test(output)) return 'repetition'
  if (JSON.stringify(digits(source)) !== JSON.stringify(digits(output))) return 'numbers_changed'
  if (source.trim() === output.trim() && /\p{Script=Arabic}/u.test(source)) return 'untranslated'
  const script = { en:/[a-z]/iu, fr:/\p{Script=Latin}/u, de:/\p{Script=Latin}/u,
    ru:/\p{Script=Cyrillic}/u, uk:/\p{Script=Cyrillic}/u, kk:/\p{Script=Cyrillic}/u,
    zh:/\p{Script=Han}/u, ja:/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
    ko:/\p{Script=Hangul}/u, hi:/\p{Script=Devanagari}/u, bn:/\p{Script=Bengali}/u,
    fa:/\p{Script=Arabic}/u, ur:/\p{Script=Arabic}/u, ug:/\p{Script=Arabic}/u }
  if (script[target] && /\p{L}/u.test(source) && !script[target].test(output)) return 'wrong_script'
  return null
}
export function queueStub(env, id) {
  const shard = parseInt(id.slice(0, 2), 16) % LOCAL_SHARDS
  return env.LOCAL_TRANSLATION_QUEUE.getByName(`hymt2:v1:${shard}`)
}

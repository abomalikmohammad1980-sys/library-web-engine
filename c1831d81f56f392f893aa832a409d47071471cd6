export const WORD_MAP_BLOCKING_MESSAGE = 'تعذرت مطابقة صفحات الملف مع Word مطابقة موثقة. الأصل عدم إضافة الكتاب حتى تُعاد معالجته.'
export type PaginationAuthority = 'word-map' | 'user-approved-estimate'
export interface PaginationConsent { paginationAuthority: 'user-approved-estimate'; paginationOverride: { consentAt: number; sourceFingerprint: string; operationId: string } }

export type WordImportAuthorityMode = 'not-word' | 'authoritative-conversion' | 'estimated-consent'

/** الاستيراد المحلي الموثق هو الأصل، والتقديري استثناء عند غياب Word أو اختيار PDF يدوي. */
export function wordImportAuthorityMode(input: {
  hasWord: boolean
  manualPdf: boolean
  wordConversionAvailable: boolean
}): WordImportAuthorityMode {
  if (!input.hasWord) return 'not-word'
  return !input.manualPdf && input.wordConversionAvailable
    ? 'authoritative-conversion'
    : 'estimated-consent'
}

export async function fingerprintBytes(bytes: Uint8Array): Promise<string> {
  const owned = new Uint8Array(bytes.length); owned.set(bytes)
  const digest = await crypto.subtle.digest('SHA-256', owned.buffer)
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

export async function requestEstimatedImportOverride(bytes: Uint8Array, confirm: (message: string) => boolean, now = Date.now): Promise<PaginationConsent | null> {
  if (!confirm(`${WORD_MAP_BLOCKING_MESSAGE}\n\nهل تريد طلب إضافة استثنائية رغم عدم المطابقة؟`)) return null
  if (!confirm('إضافة الكتاب رغم عدم المطابقة قد تجعل الترقيم والتخطيط مختلفين عن Word. هذا استثناء صريح ولا يجعل الصفحات موثقة. هل تؤكد للمرة الثانية؟')) return null
  const sourceFingerprint = await fingerprintBytes(bytes)
  return { paginationAuthority: 'user-approved-estimate', paginationOverride: { consentAt: now(), sourceFingerprint, operationId: `word-estimate-${sourceFingerprint.slice(0, 16)}` } }
}

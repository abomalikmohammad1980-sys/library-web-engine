import { importAuthorCatalog, listAuthorRecords, type AuthorCatalogRecord } from './engine/library_store'

interface ShamelaCatalogPayload {
  schemaVersion: number
  fetchedAt: string
  source: string
  authors: AuthorCatalogRecord[]
}

interface AuthorSupplementPayload {
  schemaVersion: number
  researchedAt: string
  authors: AuthorCatalogRecord[]
}

let activeImport: Promise<{ imported: number; merged: number; rejected: number }> | undefined

/** يستورد الكتالوج المضمّن مرة لكل إصدار، ويظل فشل الملف غير مانع لكتب المستخدم. */
export function ensureShamelaCatalogImported(): Promise<{ imported: number; merged: number; rejected: number }> {
  if (activeImport) return activeImport
  activeImport = (async () => {
    const [response, supplementResponse] = await Promise.all([fetch('./data/shamela-authors.json'), fetch('./data/author-supplement.json')])
    if (!response.ok) throw new Error('تعذّر تحميل كتالوج مؤلفي الشاملة')
    if (!supplementResponse.ok) throw new Error('تعذّر تحميل ملحق المؤلفين الموثق')
    const payload = await response.json() as ShamelaCatalogPayload
    const supplement = await supplementResponse.json() as AuthorSupplementPayload
    if (!Array.isArray(payload.authors) || payload.schemaVersion !== 1) throw new Error('صيغة كتالوج المؤلفين غير مدعومة')
    if (supplement.schemaVersion !== 1 || !Array.isArray(supplement.authors)) throw new Error('صيغة ملحق المؤلفين غير مدعومة')
    const marker = `alkhizana:shamela-authors:${payload.fetchedAt}:${supplement.researchedAt}`
    if (localStorage.getItem(marker) === 'done') {
      // قد يبقى localStorage بعد مسح IndexedDB وحده؛ لا نسمح للمؤشر القديم
      // أن يخفي الكتالوج الأصلي من موقع جديد أو مخزن أُعيد إنشاؤه.
      const existing = await listAuthorRecords(false)
      if (existing.some(author => Boolean(author.shamelaId))) return { imported: 0, merged: 0, rejected: 0 }
      localStorage.removeItem(marker)
    }
    const additions = supplement.authors.map(normalizeSupplementAuthor).filter((author): author is AuthorCatalogRecord => author !== undefined)
    const result = await importAuthorCatalog([...payload.authors.map(normalizeCatalogAuthor), ...additions])
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index)
      if (key?.startsWith('alkhizana:shamela-authors:')) localStorage.removeItem(key)
    }
    localStorage.setItem(marker, 'done')
    return result
  })().catch(error => { activeImport = undefined; throw error })
  return activeImport
}

export function normalizeSupplementAuthor(author: AuthorSupplementPayload['authors'][number]): AuthorCatalogRecord | undefined {
  if (!author.name?.trim() || !['high', 'review', 'unresolved'].includes(author.metadataConfidence ?? '')
    || !['verified', 'review', 'unresolved'].includes(author.researchStatus ?? '')) return undefined
  const sources = author.researchSources ?? []
  if (sources.some(source => !/^https:\/\//.test(source.url) || !/^\d{4}-\d{2}-\d{2}$/.test(source.accessedAt))) return undefined
  if (author.researchStatus === 'verified' && (author.metadataConfidence !== 'high' || sources.length === 0)) return undefined
  if (author.researchStatus !== 'verified' && (sources.length > 0 || author.biography || author.birthYearHijri !== undefined || author.deathYearHijri !== undefined || author.contemporary !== undefined)) return undefined
  return author
}

const BIOGRAPHY_CONTAMINATION_MARKERS = [
  '&times;', '×', 'البحث في:', 'البحث في :', 'بحث في محتوى الكتب:', 'تنبيهات هامة:',
  'تنزيل المكتبة الشاملة', 'للحاسوب للأندرويد للآيفون',
] as const

/**
 * يحتفظ بالنص العلمي السابق لأول حد واجهة معروف، ثم يرفض أي بقايا HTML أو
 * تعليمات بحث أو روابط. لا نحاول إصلاح نص ملوث بالتخمين.
 */
export function sanitizeVerifiedBiography(value: string | undefined, sourceUrl?: string): string | undefined {
  if (!value?.trim() || !sourceUrl || !/^https:\/\/shamela\.ws\/author\/\d+\/?$/u.test(sourceUrl)) return undefined
  const controlsRemoved = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
  const boundaries = BIOGRAPHY_CONTAMINATION_MARKERS.map(marker => controlsRemoved.indexOf(marker)).filter(index => index >= 0)
  const candidate = controlsRemoved.slice(0, boundaries.length ? Math.min(...boundaries) : controlsRemoved.length)
    .replace(/\s+/gu, ' ').replace(/\s+([،؛:.!?])/gu, '$1').trim()
  if (candidate.length < 12
    || /<\/?[a-z][^>]*>|&(?:#\d+|#x[\da-f]+|[a-z]+);|https?:\/\/|www\.|(?:استخدام علامة|افتراضيا يتم البحث|جميع الأقسام|بحث في نطاق)/iu.test(candidate)) return undefined
  return candidate
}

export function normalizeCatalogAuthor(author: AuthorCatalogRecord): AuthorCatalogRecord {
  const biography = sanitizeVerifiedBiography(author.biography, author.sourceUrl)
  const normalized = { ...author, ...(biography ? { biography } : {}) }
  if (!biography) delete normalized.biography
  if (!biography) return normalized
  const digits = biography.replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  const opening = digits.slice(0, 360)
  const range = opening.match(/\b\d{2,4}\s*[-–—]\s*(\d{2,4})\s*هـ/)
  const explicit = opening.match(/(?:ت\s*|وفاة[^\d]{0,12})(\d{2,4})\s*هـ/)
  const deathYearHijri = Number(range?.[1] ?? explicit?.[1] ?? normalized.deathYearHijri ?? 0)
  return deathYearHijri > 0 && deathYearHijri < 2000 ? { ...normalized, deathYearHijri } : normalized
}

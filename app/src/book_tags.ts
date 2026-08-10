export interface TagHeading { title: string; level?: number; paragraphIndex?: number; pageId?: number }
export interface BookTag { name: string; source: 'toc' | 'manual'; confidence?: number; paragraphIndex?: number; pageId?: number }

const GENERIC = /^(?:مقدمة|المقدمة|تمهيد|التمهيد|خاتمة|الخاتمة|فهرس(?: المحتويات)?|المحتويات|باب|فصل|مبحث|مطلب|الجزء (?:الأول|الثاني|الثالث|الرابع|الخامس)|المراجع|المصادر)$/u

export function cleanTagCandidate(value: string): string {
  return value
    .replace(/[ـ]+/gu, '')
    .replace(/^\s*[\d٠-٩]+\s*/u, '')
    .replace(/^\s*[\p{P}\p{S}]+\s*/u, '')
    .replace(/^\s*(?:ال)?(?:باب|فصل|مبحث|مطلب)\s+(?:(?:[\d٠-٩]+|الأول|الثاني|الثالث|الرابع|الخامس)\s*[:،.\-–—]*\s*)?/u, '')
    .replace(/\s+/gu, ' ')
    .trim()
}

function key(value: string): string {
  return value.normalize('NFKD').replace(/[\u064B-\u065F\u0670]/gu, '').replace(/[أإآ]/gu, 'ا').replace(/ى/gu, 'ي').replace(/ة/gu, 'ه').replace(/[^\p{L}\p{N}]+/gu, '')
}

export function suggestTagsFromHeadings(headings: readonly TagHeading[], limit = 12): BookTag[] {
  const candidates = new Map<string, { tag: BookTag; score: number }>()
  for (const heading of headings) {
    const name = cleanTagCandidate(heading.title)
    if (!name || name.length < 3 || name.length > 70 || GENERIC.test(name)) continue
    const normalized = key(name)
    if (!normalized) continue
    const level = Math.max(1, heading.level ?? 2)
    const score = Math.max(1, 7 - level) + (name.split(' ').length <= 6 ? 2 : 0)
    const previous = candidates.get(normalized)
    const tag: BookTag = { name, source: 'toc', confidence: Math.min(.98, .55 + score / 20), ...(heading.paragraphIndex !== undefined ? { paragraphIndex: heading.paragraphIndex } : {}), ...(heading.pageId !== undefined ? { pageId: heading.pageId } : {}) }
    if (!previous || score > previous.score) candidates.set(normalized, { tag, score })
  }
  return [...candidates.values()].sort((a, b) => b.score - a.score || a.tag.name.localeCompare(b.tag.name, 'ar')).slice(0, limit).map(item => item.tag)
}

export function parseReviewedTags(value: string, suggestions: readonly BookTag[]): BookTag[] {
  const seen = new Set<string>()
  return value.split(/[,،\n]+/u).map(cleanTagCandidate).filter(Boolean).flatMap(name => {
    const normalized = key(name)
    if (!normalized || seen.has(normalized)) return []
    seen.add(normalized)
    const suggested = suggestions.find(tag => key(tag.name) === normalized)
    return [suggested ? { ...suggested, name } : { name, source: 'manual' as const }]
  })
}

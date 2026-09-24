import { describe, expect, it } from 'vitest'
import { arabicAffixExpansionTerm, deriveSearchTerm, normalizeArabic, pageForParagraph, searchTextSegments, virtualRange } from './search_presentation'

describe('search presentation helpers', () => {
  it('separates a continued unnumbered note only with repeated body-entry evidence',()=>{
    const text='٧٣٣٠ - حديث في المتن.\n٧٣٣١ - حدثنا إسحاق\n\n= قلت: وكنت أظن أن أبا حاتم قد وهم.\n٧٣٣٠ - صحيح: مضى قريبًا.\n٧٣٣١ - صحيح: أخرجه البخاري.'
    const segments=searchTextSegments(text)
    expect(segments.filter(segment=>segment.separator)).toHaveLength(1)
    expect(segments.find(segment=>segment.separator)?.start).toBe(text.indexOf('\n\n='))
    expect(segments.map(segment=>segment.text).join('')).toBe(text)
    expect(searchTextSegments('شرح\n\n= معادلة أو توضيح عادي').some(segment=>segment.separator)).toBe(false)
  })
  it('normalizes Arabic marks and letter variants', () => {
    expect(normalizeArabic('إِلَى الـقُرْآنِ ـ ة')).toBe('الي القران ه')
  })

  it('يطبع نسخة البحث فقط ولا يغيّر النص الأصلي ذي الكشيدة', () => {
    const original = 'الرَّحـمٰن'
    expect(normalizeArabic(original)).toBe('الرحمن')
    expect(original).toBe('الرَّحـمٰن')
  })

  it('derives useful morphological and root terms', () => {
    expect(deriveSearchTerm('والقلوب', 'morphological')).toBe('قلوب')
    expect(deriveSearchTerm('والقلوب', 'root')).toBe('قلب')
  })

  it('expands Arabic conservatively with bounded local clitic normalization', () => {
    expect(arabicAffixExpansionTerm('والقلوب فكتاباتهم')).toBe('قلوب كتابات')
    const long = Array.from({ length: 30 }, () => 'والعلماء').join(' ')
    expect(arabicAffixExpansionTerm(long).split(' ')).toHaveLength(12)
    expect(arabicAffixExpansionTerm('وو')).toBe('وو')
  })

  it('maps a paragraph to the adjusted Word page', () => {
    const map = { totalPages: 2, paragraphCount: 8, starts: [
      { paragraphIndex: 0, physicalPage: 1, adjustedPage: 5 },
      { paragraphIndex: 4, physicalPage: 2, adjustedPage: 6 },
    ] }
    expect(pageForParagraph(map, 6)).toBe(6)
  })

  it('keeps the rendered window bounded for huge result sets', () => {
    const range = virtualRange(174 * 50_000, 100_000)
    expect(range.start).toBeGreaterThan(49_000)
    expect(range.end - range.start).toBeLessThanOrEqual(36)
  })

  it('infers one separator from the complete snippet and does not style verse numbers', () => {
    const segments = searchTextSegments('الآية [٥٠] ثم إحالة (١)\n(١) الحاشية الأولى\n(٢) الحاشية الثانية')
    expect(segments.filter(segment => segment.separator)).toHaveLength(1)
    expect(segments.find(segment => segment.text === '[٥٠]')?.footnote).toBe(false)
    expect(segments.filter(segment => segment.text === '(١)').every(segment => segment.footnote)).toBe(true)
  })

  it('places an inferred separator before the first visible footnote even when the match is inside it', () => {
    const text = '… بغداد ٤/ ١٠٢، وفيات ١/ ١٢٠، لسان ١/ ١٥٩.\n(٣) هذا صَدْر بيت مشهور، عَجْزه: تجري الرياح بما لا تشتهي السفن\nانظر: شرح الديوان.\n(٤) في (ت): حالًا.\n(٥) أي: معنى القول.'
    const segments = searchTextSegments(text)
    const separator = segments.findIndex(segment => segment.separator)
    const firstFootnote = segments.findIndex(segment => segment.text === '(٣)' && segment.footnote)
    expect(separator).toBeGreaterThanOrEqual(0)
    expect(separator).toBeLessThan(firstFootnote)
    expect(segments.filter(segment => segment.separator)).toHaveLength(1)
  })

  it('places the separator before an initial footnote whose body is glued to its closing parenthesis', () => {
    const text = 'نهاية المتن وإحالته (٣).\n(٣)هذا نص الحاشية الأولى بلا فراغ\n(٤) الحاشية التالية\n(٥) الحاشية الأخيرة'
    const segments = searchTextSegments(text)
    const separator = segments.findIndex(segment => segment.separator)
    const firstFootnote = segments.findIndex(segment => segment.text === '(٣)' && segment.footnote && segment.start > text.indexOf('\n'))
    expect(separator).toBeGreaterThanOrEqual(0)
    expect(separator).toBeLessThan(firstFootnote)
    expect(segments.filter(segment => segment.separator)).toHaveLength(1)
  })
})

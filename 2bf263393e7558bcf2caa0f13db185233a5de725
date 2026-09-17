import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { extractFromDocx } from '@engine/ooxml-model'
import { auditWordPageMap, auditWordPageMapStructure, domFontFaces, effectivePageHeight, groupsFromWordPageMap, registerDomFonts, requireWordPageGroups, runtimeDomFontBase, WordPageMapMismatchError, wordLabelForPhysicalPage } from './dom_render'
import { paragraphCss, runCss } from '@engine/ooxml-dom'

const DOCX = new URL('../../public/books/sample-ahadith.docx', import.meta.url)
const PAGE_AUDIT_DOCX = new URL('../../../corpus/books/sample-muqtarah.docx', import.meta.url)
const PAGE_AUDIT_JSON = new URL('../../../corpus/ground-truth/sample-muqtarah.pages.json', import.meta.url)
const TAWHID = new URL('../../../../../كتب للاختبار/توحيد الحاكمية.docx', import.meta.url)
const MINHAJ = new URL('../../../../../كتب للاختبار/منهاج مخيم جيل العزة - المخيم الصيفي لمدة أسبوع.docx', import.meta.url)
const MINHAJ_WORD_MODEL_STARTS = [0, 10, 25, 43, 52, 64, 69, 94, 126, 129, 145, 161, 176, 188,
  195, 209, 218, 234, 248, 253, 267, 271, 287, 300, 312, 327, 330, 348, 370, 390, 418, 441,
  468, 473, 485, 499, 511, 515, 530, 535, 547]

describe('DOM render — خطوط المستند المخدومة', () => {
  it('يحل مسار الخطوط بجوار التطبيق عند النشر تحت مسار فرعي', () => {
    expect(runtimeDomFontBase('https://example.test/khizana/index.html')).toBe('https://example.test/khizana/fonts/')
    expect(runtimeDomFontBase('https://example.test/index.html')).toBe('https://example.test/fonts/')
  })

  it('يطابق خريطة Word الحقيقية لمنهاج مخيم جيل العزة', () => {
    const model = extractFromDocx(readFileSync(MINHAJ))
    // Captured independently from Microsoft Word COM (41 physical pages / 686
    // Word paragraphs), then reconciled once to the 558 OOXML model paragraphs.
    // Keep these authoritative model boundaries separate from the 59 explicit
    // XML groups: explicit breaks are not Word's final physical pagination.
    const map = {
      totalPages: 41,
      paragraphCount: model.paragraphs.length,
      starts: MINHAJ_WORD_MODEL_STARTS.map((paragraphIndex, index) => ({
        paragraphIndex, physicalPage: index + 1, adjustedPage: index + 1,
      })),
    }
    const groups = requireWordPageGroups(model, map)
    expect(groups).toHaveLength(41)
    expect(groups.map(group => group[0]?.index ?? null)).toEqual(MINHAJ_WORD_MODEL_STARTS.map(index => index + 1))
    expect(groups[0]![0]!.text).toContain('بسم الله الرحمن الرحيم')
    expect(groups.at(-1)!.at(-1)!.text).toContain('وَأَنتُمُ الْأَعْلَوْنَ')
  })
  it('يعرض الورقة الفيزيائية ورقم Word المعدّل دون تغيير فهرس التنقل الصفري', () => {
    const map = { totalPages: 72, paragraphCount: 1, starts: [{ paragraphIndex: 0, physicalPage: 1, adjustedPage: 2 }] }
    expect([6, 17, 46].map(slot => slot + 1)).toEqual([7, 18, 47])
    expect([6, 17, 46].map(slot => wordLabelForPhysicalPage(map, slot + 1))).toEqual([8, 19, 48])
  })
  it('يقسم الفقرات حسب خريطة Microsoft Word ويحفظ الصفحات الفارغة', () => {
    const model = extractFromDocx(readFileSync(DOCX))
    const groups = groupsFromWordPageMap(model, {
      totalPages: 3,
      paragraphCount: model.paragraphs.length,
      starts: [
        { paragraphIndex: 0, physicalPage: 1, adjustedPage: 1 },
        { paragraphIndex: 3, physicalPage: 3, adjustedPage: 3 },
      ],
    })
    expect(groups).not.toBeNull()
    expect(groups![0]).toHaveLength(3)
    expect(groups![1]).toHaveLength(0)
    expect(groups![2]).toHaveLength(model.paragraphs.length - 3)
  })

  it('يطابق محارف Word COM البنيوية ونتيجة TOC المحدثة ورمز الخط الزخرفي دون تعميمها على المتن', () => {
    const model = extractFromDocx(readFileSync(DOCX))
    const paragraphs = model.paragraphs.slice(0, 3)
    paragraphs[0] = { ...paragraphs[0]!, text: 'عنوان\t14' }
    paragraphs[1] = { ...paragraphs[1]!, text: '\uf060\uf05e\uf060', runs: [{
      ...paragraphs[1]!.runs[0]!, text: '\uf060\uf05e\uf060', family: 'AGA Arabesque',
    }] }
    const smallModel = { ...model, paragraphs }
    const map = { totalPages: 2, paragraphCount: 3,
      starts: [{ paragraphIndex: 0, physicalPage: 1, adjustedPage: 1 }],
      paragraphs: [
        { paragraphIndex: 0, physicalPage: 1, adjustedPage: 1, text: '\u000eعنوان\t16' },
        { paragraphIndex: 1, physicalPage: 1, adjustedPage: 1, text: '(((' },
        { paragraphIndex: 2, physicalPage: 2, adjustedPage: 2, text: paragraphs[2]!.text },
      ] }
    expect(groupsFromWordPageMap(smallModel, map)?.map(group => group.length)).toEqual([2, 1])
    map.paragraphs[2]!.text = 'نص مؤلف مختلف'
    expect(groupsFromWordPageMap(smallModel, map)).toBeNull()
  })

  it('يدقق أول وآخر محتوى لكل صفحة كما قرأهما Word', () => {
    const model = extractFromDocx(readFileSync(DOCX))
    const first = model.paragraphs[0]!.text
    const last = model.paragraphs[2]!.text
    const map = {
      totalPages: 2,
      paragraphCount: model.paragraphs.length,
      starts: [
        { paragraphIndex: 0, physicalPage: 1, adjustedPage: 1 },
        { paragraphIndex: 3, physicalPage: 2, adjustedPage: 2 },
      ],
      pages: [{
        physicalPage: 1, adjustedPage: 1,
        firstParagraphIndex: 0, lastParagraphIndex: 2,
        firstText: ` ${first}\r`, lastText: last,
      }],
    }
    expect(auditWordPageMap(model, map)).toEqual({ checked: 2, mismatches: [] })
    map.pages[0]!.lastText = 'نص مختلف'
    expect(auditWordPageMap(model, map).mismatches).toEqual([
      expect.objectContaining({ physicalPage: 1, edge: 'last', expected: 'نص مختلف', actual: last }),
    ])
  })

  it('يطابق أول وآخر فقرة في الصفحات الخمس لعينة Word الحقيقية', () => {
    const model = extractFromDocx(readFileSync(PAGE_AUDIT_DOCX))
    const map = JSON.parse(readFileSync(PAGE_AUDIT_JSON, 'utf8'))
    const result = auditWordPageMap(model, map)
    expect(result.checked).toBe(10)
    expect(result.mismatches).toEqual([])
    // Word يعد ست فقرات خلايا فارغة إضافية لا يقابلها BodyParagraph مستقل؛
    // المحاذاة النصية تحفظ الصفحات الخمس من دون افتراض تساوي العدّادين.
    expect(groupsFromWordPageMap(model, map)?.map((page) => page.length)).toEqual([10, 6, 7, 21, 15])
    expect(requireWordPageGroups(model, map)).toHaveLength(map.totalPages)
    expect(map.pages.map((page: { physicalPage: number; adjustedPage: number }) =>
      [page.physicalPage, wordLabelForPhysicalPage(map, page.physicalPage)]))
      .toEqual(map.pages.map((page: { physicalPage: number; adjustedPage: number }) =>
        [page.physicalPage, page.adjustedPage]))
  })

  it('يرفض خريطة Word الموثقة إذا فقدت ورقة أو كررت رقمًا بدل fallback صامت', () => {
    const model = extractFromDocx(readFileSync(DOCX))
    const map = {
      totalPages: 2,
      paragraphCount: model.paragraphs.length,
      starts: [{ paragraphIndex: 0, physicalPage: 1, adjustedPage: 1 }],
      pages: [
        { physicalPage: 1, adjustedPage: 1, firstParagraphIndex: 0, lastParagraphIndex: 1, firstText: '', lastText: '' },
        { physicalPage: 1, adjustedPage: 2, firstParagraphIndex: 2, lastParagraphIndex: 3, firstText: '', lastText: '' },
      ],
    }
    expect(auditWordPageMapStructure(map).mismatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ physicalPage: 1 }),
      expect.objectContaining({ physicalPage: 2, actual: 'مفقود' }),
    ]))
    expect(() => requireWordPageGroups(model, map)).toThrow(WordPageMapMismatchError)
  })

  it('يحفظ bookmark داخل مجموعة ورقته الموثقة ولا ينقله إلى تسمية مجاورة', () => {
    const model = extractFromDocx(readFileSync(DOCX))
    const target = model.paragraphs[3]!
    target.bookmarkIds = ['target-page-two']
    const map = {
      totalPages: 2,
      paragraphCount: model.paragraphs.length,
      starts: [
        { paragraphIndex: 0, physicalPage: 1, adjustedPage: 7 },
        { paragraphIndex: 3, physicalPage: 2, adjustedPage: 8 },
      ],
    }
    const groups = requireWordPageGroups(model, map)
    const slot = groups.findIndex(group => group.some(paragraph => paragraph.bookmarkIds?.includes('target-page-two')))
    expect(slot).toBe(1)
    expect(wordLabelForPhysicalPage(map, slot + 1)).toBe(8)
  })

  it('يحفظ حدود Word الفيزيائية في توحيد الحاكمية ولا يدمج ص3 وص4', () => {
    const model = extractFromDocx(readFileSync(TAWHID))
    const starts = [0, 1, 2, 8, 18, 24, 28, 32, 42, 49, 56, 60, 63, 68, 73, 77,
      80, 85, 91, 96, 99, 107, 113, 118, 125, 127, 131, 144, 155, 162, 167, 175]
      .map((paragraphIndex, index) => ({ paragraphIndex, physicalPage: index + 1, adjustedPage: index + 1 }))
    const pageOf = (paragraphIndex: number): number => {
      let physicalPage = 1
      for (const start of starts) {
        if (start.paragraphIndex > paragraphIndex) break
        physicalPage = start.physicalPage
      }
      return physicalPage
    }
    const map = {
      totalPages: 32,
      paragraphCount: 183,
      starts,
      paragraphs: model.paragraphs.map((paragraph, paragraphIndex) => ({
        paragraphIndex, physicalPage: pageOf(paragraphIndex), adjustedPage: pageOf(paragraphIndex),
        text: !paragraph.text.trim() && paragraph.anchors.some(anchor => anchor.inlineFlow) ? '/' : paragraph.text,
      })),
    }
    const groups = requireWordPageGroups(model, map)
    expect(model.paragraphs).toHaveLength(183)
    expect(groups).toHaveLength(32)
    expect(groups[2]!.some(paragraph => paragraph.text.includes('مقدمة الناشر'))).toBe(false)
    expect(groups[2]!.filter(paragraph => paragraph.anchors.some(anchor => anchor.inlineFlow))).toHaveLength(2)
    expect(groups[3]!.some(paragraph => paragraph.text.includes('مقدمة الناشر'))).toBe(true)
    expect(groups[8]!.some(paragraph => paragraph.text.includes('توحيد الحاكمية للشيخ'))).toBe(true)
    expect(groups.map((_group, index) => wordLabelForPhysicalPage(map, index + 1)))
      .toEqual(Array.from({ length: 32 }, (_unused, index) => index + 1))
    expect(auditWordPageMap(model, { ...map, pages: [{
      physicalPage: 3, adjustedPage: 3, firstParagraphIndex: 2, lastParagraphIndex: 7,
      firstText: '/', lastText: '/',
    }] }).mismatches).toEqual([])
  })

  it('يمدّد إطار الصفحة للمحتوى الأطول مع إبقاء ارتفاع Word حدًا أدنى', () => {
    expect(effectivePageHeight(1123, 1523)).toBe(1523)
    expect(effectivePageHeight(1123, 900)).toBe(1123)
  })

  it('يربط Sakkal Majalla بملفه الأصلي بدل خط بديل يغيّر عدد الأسطر', () => {
    const model = extractFromDocx(readFileSync(DOCX))
    const faces = domFontFaces(model)

    expect(faces).toContainEqual(expect.objectContaining({
      family: 'Sakkal Majalla',
      file: 'majalla.ttf',
    }))
  })

  it('يسجّل عائلة Al-Jazeera المطلوبة في XML بملفها الحقيقي', () => {
    const model = extractFromDocx(readFileSync(DOCX))
    const faces = domFontFaces(model)

    expect(faces).toContainEqual({
      family: 'Al-Jazeera-Arabic-Regular',
      file: 'Al-Jazeera-Arabic-Regular.ttf',
      weight: '400',
      style: 'normal',
    })
  })

  it('لا يعيد تحميل وجوه الخطوط المخدومة عند إعادة فتح الكتاب نفسه', async () => {
    const model = extractFromDocx(readFileSync(DOCX))
    const load = vi.fn(async () => undefined), add = vi.fn()
    class TestFontFace { load = async (): Promise<TestFontFace> => { await load(); return this } }
    vi.stubGlobal('FontFace', TestFontFace)
    vi.stubGlobal('document', { fonts: { add } })
    try {
      await registerDomFonts(model, '/lifecycle-fonts/')
      const firstLoads = load.mock.calls.length
      expect(firstLoads).toBeGreaterThan(0)
      await registerDomFonts(model, '/lifecycle-fonts/')
      expect(load).toHaveBeenCalledTimes(firstLoads)
      expect(add).toHaveBeenCalledTimes(firstLoads)
    } finally { vi.unstubAllGlobals() }
  })

  it('يسجّل خط رأس Word الموجود داخل مربع نص عائم', () => {
    const nested = { runs: [{ family: 'Aljazeera', bold: false, italic: false }], anchors: [] }
    const header = { runs: [], anchors: [{ textBox: [nested] }] }
    const model = {
      paragraphs: [], footnotes: new Map(), endnotes: new Map(),
      headerFooters: new Map([['header1.xml', [header]]]),
    } as unknown as Parameters<typeof domFontFaces>[0]

    expect(domFontFaces(model)).toContainEqual({
      family: 'Aljazeera', file: 'Al-Jazeera-Arabic-Regular.ttf', weight: '400', style: 'normal',
    })
  })

  it('يحفظ اتجاه الرن العربي في النموذج دون عزله عن أجزاء الكلمة المجاورة', () => {
    const model = extractFromDocx(readFileSync(DOCX))
    const run = model.paragraphs.flatMap((p) => p.runs)
      .find((r) => r.text.includes('بسم الله الرحمن الرحيم'))

    expect(run?.direction).toBe('rtl')
    expect(runCss(run!)).not.toContain('unicode-bidi:isolate')
  })

  it('يورّث w:bidi من نمط الفقرة فتُرتّب الرنّات من اليمين', () => {
    const model = extractFromDocx(readFileSync(DOCX))
    const paragraph = model.paragraphs
      .find((p) => p.text.includes('بِرُّ الوالِدَينِ مِن أَعظَمِ القُرُبات'))

    expect(paragraph?.bidi).toBe(true)
    expect(paragraphCss(paragraph!)).toContain('direction:rtl')
  })
})

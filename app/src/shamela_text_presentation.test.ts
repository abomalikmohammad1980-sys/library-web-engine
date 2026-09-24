import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { materializeShamelaCatalogBook, materializeShamelaPackBook } from './shamela_pack_seed'
import { cleanShamelaFootnoteMarks, cleanShamelaPlainText, displayableHijriPublicationYear, isShamelaBasmalah, parseShamelaStructuralText, parseTextualFootnoteLine, remapShamelaPlainTextOffset, shamelaSymbolParts, splitTextualFootnoteEntries } from './shamela_text_presentation'

describe('Shamela/BOK text presentation', () => {
  it('exposes the established devotional symbols with semantic labels', () => {
    expect(shamelaSymbolParts('قال النووي ﵀ والنبي ﷺ والله ﷿').filter(part => part.label)).toEqual([
      { text: 'رحمه الله', label: 'رحمه الله' },
      { text: 'صلى الله عليه وسلم', label: 'صلى الله عليه وسلم' },
      { text: 'جل جلاله', label: 'جل جلاله' },
    ])
  })

  it('يعرض صيغ الترضي والترحم والتعظيم نصًا ويترك الفاصلة وPUA المجهول بلا تخمين', () => {
    const value = '﵁ ﵂ ﵃ ﵄ ﵅ ﵆ ﵉ ﵊ ﵍ ﵎ ﵏ ﷻ ﷾، \uE123'
    expect(shamelaSymbolParts(value).map(part => part.text).join('')).toBe(
      'رضي الله عنه رضي الله عنها رضي الله عنهم رضي الله عنهما رضي الله عنهن صلى الله عليه وآله عليهما السلام عليه الصلاة والسلام عليها السلام تبارك وتعالى رحمهم الله جل جلاله سبحانه وتعالى، \uE123',
    )
    expect(shamelaSymbolParts('،')).toEqual([{ text: '،' }])
    expect(shamelaSymbolParts('﹐﹑，')).toEqual([{ text: '،،،' }])
    expect(shamelaSymbolParts('\uE123')).toEqual([{ text: '\uE123' }])
  })

  it('drops only the internal not-sign before footnote numbers and recognizes basmalah', () => {
    expect(cleanShamelaFootnoteMarks('المتن (¬١)\n(¬٢) الحاشية')).toBe('المتن (١)\n(٢) الحاشية')
    expect(cleanShamelaFootnoteMarks('نفي ¬ القضية')).toBe('نفي ¬ القضية')
    expect(isShamelaBasmalah('﷽')).toBe(true)
    expect(isShamelaBasmalah('بسم الله الرحمن الرحيم')).toBe(true)
    expect(isShamelaBasmalah('قال: بسم الله الرحمن الرحيم ثم بدأ')).toBe(false)
    expect(isShamelaBasmalah('بسم الله الرحمن الرحيم، والصلاة والسلام')).toBe(false)
  })

  it('isolates Arabic and Latin footnote markers, removes encoding debris, and aligns continuations', () => {
    expect(parseTextualFootnoteLine('(¬١٢) متن الحاشية')).toEqual({ marker: '١٢', body: 'متن الحاشية', continuation: false })
    expect(parseTextualFootnoteLine('[23] second note')).toEqual({ marker: '23', body: 'second note', continuation: false })
    expect(parseTextualFootnoteLine('وتتمة الحاشية ¬ هنا', true)).toEqual({ body: 'وتتمة الحاشية  هنا', continuation: true })
    expect(parseTextualFootnoteLine('سنة ١٤٤١ في المتن')).toBeUndefined()
    expect(splitTextualFootnoteEntries('(¬١) الأولى.(¬٢) الثانية.(¬٣) الثالثة.', true)).toEqual([
      '(١) الأولى.', '(٢) الثانية.', '(٣) الثالثة.',
    ])
    expect(splitTextualFootnoteEntries('سنة ١٤٤١ في المتن')).toEqual(['سنة ١٤٤١ في المتن'])
  })

  it('treats master sentinel years as unavailable without inventing a replacement', () => {
    expect(displayableHijriPublicationYear(99999)).toBeUndefined()
    expect(displayableHijriPublicationYear(1441)).toBe(1441)
  })

  it('applies the contract to the real 4625-page shamela-11 artifact', () => {
    const root = resolve(process.cwd(), 'app/public/library/shamela-sample')
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'))
    const entry = manifest.books.find((book: { bookId: string }) => book.bookId === '11')
    const packed = readFileSync(resolve(root, entry.file))
    const raw = JSON.parse(packed.toString('utf8'))
    expect(raw.metadata.bookDate).toBe(99999)
    const catalog = materializeShamelaCatalogBook(entry)
    const book = materializeShamelaPackBook(raw, new Uint8Array(packed), entry.sha256)
    expect(book.bokPages).toHaveLength(4625)
    expect(book.publicationYearHijri).toBeUndefined()
    expect(catalog.publicationYearHijri).toBeUndefined()
    expect(book.bokPages?.[0]?.text).toContain('_________')
    expect(cleanShamelaFootnoteMarks(book.bokPages?.[0]?.text ?? '')).not.toMatch(/¬(?=\s*[\d٠-٩۰-۹])/u)
    expect(book.bokPages?.[0]?.text).toContain('﷽')
    expect(book.bokPages?.[0]?.text).toContain('﵀')
    const joinedFootnotes = raw.pages.find((page: { sourceRowId: string }) => page.sourceRowId === '2')?.foot ?? ''
    const entries = splitTextualFootnoteEntries(joinedFootnotes, true)
    expect(entries).toHaveLength(4)
    expect(entries.every(entry => parseTextualFootnoteLine(entry, true)?.marker)).toBe(true)
    expect(entries.join('')).not.toContain('¬')
    const corpusText = raw.pages.map((page: { body?: string | null; foot?: string | null }) => `${page.body ?? ''}${page.foot ?? ''}`).join('')
    const observedHonorifics = new Set(corpusText.match(/[ﷺ﵀-﵏ﷻ﷾﷿]/gu) ?? [])
    expect([...observedHonorifics].sort()).toEqual(['ﷺ', '﵀', '﵁', '﵂', '﵃', '﵄', '﵅', '﵇', '﵈', '﵉', '﵊', '﵌', '﵍', '﵎', '﵏', 'ﷻ', '﷾', '﷿'].sort())
    for (const symbol of observedHonorifics) expect(shamelaSymbolParts(symbol)[0]?.label).toBeTruthy()
  })
})


describe('Shamela semantic plain-text cleanup', () => {
  it('keeps Arabic link labels and removes valid, malformed, and escaped inr markup', () => {
    expect(cleanShamelaPlainText('قال <a href="inr://man-123">ابن تيمية</a>: النص')).toBe('قال ابن تيمية: النص')
    expect(cleanShamelaPlainText("<a href='inr://book-7'>العربية &amp; علومها</a>")).toBe('العربية & علومها')
    expect(cleanShamelaPlainText('&lt;"a href="inr://man-238&gt;أبو بكر&lt;a/&gt;')).toBe('أبو بكر')
  })

  it('turns structural Shamela separators into lines without exposing raw tags', () => {
    const clean = cleanShamelaPlainText('العنوان\r<hr>الشرح\n<s0>الحاشية <span title="فائدة">مهمة</span><br>آخر')
    expect(clean).toBe('العنوان\nالشرح\nالحاشية مهمة\nآخر')
    expect(clean).not.toMatch(/(?:<\/?(?:hr|s\d+|span|a)\b|inr:\/\/)/iu)
    expect(cleanShamelaPlainText(clean)).toBe(clean)
  })

  it('preserves hr and sN as semantic controls at their cleaned-text offsets', () => {
    const parsed = parseShamelaStructuralText('صدر<hr><s2>تفصيل<br>خاتمة')
    expect(parsed.text).toBe('صدر\nتفصيل\nخاتمة')
    expect(parsed.controls).toEqual([
      { kind: 'separator', offset: 3 },
      { kind: 'style', level: 2, offset: 4 },
    ])
    expect(parsed.text).not.toMatch(/<\/?(?:hr|s\d+)\b/iu)
  })

  it('decodes escaped structural tags without losing their semantic controls', () => {
    expect(parseShamelaStructuralText('أ&lt;hr&gt;&lt;s4&gt;ب')).toEqual({
      text: 'أ\nب',
      controls: [
        { kind: 'separator', offset: 1 },
        { kind: 'style', level: 4, offset: 2 },
      ],
    })
  })

  it('drops executable wrappers and preserves unknown numeric entities verbatim', () => {
    expect(cleanShamelaPlainText('قبل<script>alert(1)</script>بعد')).toBe('قبلبعد')
    expect(cleanShamelaPlainText('&#x110000;')).toBe('&#x110000;')
  })

  it('remaps scientific inline-control offsets after removing internal markup', () => {
    const raw = 'قال <a href="inr://man-123">ابن تيمية</a>: النص'
    const rawOffset = raw.indexOf('النص')
    const clean = cleanShamelaPlainText(raw)
    expect(remapShamelaPlainTextOffset(raw, rawOffset)).toBe(clean.indexOf('النص'))
  })
})

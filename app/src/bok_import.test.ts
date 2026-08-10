import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decodeShamelaJetText, parseBok, parseBokBetaka } from './bok_import'

const corpus = new URL('../../../../كتب للاختبار/', import.meta.url)
const files = readdirSync(corpus).filter(name => name.toLocaleLowerCase().endsWith('.bok'))

describe('BOK الشاملة — Jet corpus', () => {
  it('decodes the legacy Windows-1256 mojibake without touching valid Arabic', () => {
    expect(decodeShamelaJetText('ÃÚáÇã ÇáÓäÉ')).toBe('أعلام السنة')
    expect(decodeShamelaJetText('مقدمة ÃÚáÇã ÇáÓäÉ')).toBe('مقدمة أعلام السنة')
    expect(decodeShamelaJetText('نص عربي صحيح')).toBe('نص عربي صحيح')
  })

  it('parses every provided BOK with metadata, original pages and TOC', () => {
    expect(files.length).toBeGreaterThanOrEqual(9)
    let booksWithStructuredPublishingData = 0
    let pagesWithExplicitFootnoteSignals = 0
    for (const name of files) {
      const parsed = parseBok(readFileSync(new URL(name, corpus)), name)
      expect(parsed.title.length).toBeGreaterThan(2)
      expect(parsed.author.length).toBeGreaterThan(2)
      expect(parsed.pages.length).toBeGreaterThan(0)
      expect(parsed.pages.every(page => page.part > 0 && page.page > 0 && page.text.length > 0)).toBe(true)
      expect(parsed.extractedText).toContain(parsed.pages[0].text)
      expect(parsed.toc.length).toBeGreaterThan(0)
      if (parsed.publisher || parsed.edition || parsed.investigator || parsed.publicationYearHijri) booksWithStructuredPublishingData++
      pagesWithExplicitFootnoteSignals += parsed.pages.filter(page => /(?:^|\n)(?:[_ـ=-]{3,}|الحواشي\s*:?|\(\s*\d+\s*\)|\[\s*\d+\s*\])(?:\s|$)/u.test(page.text)).length
      // حين يكون عنوان الفهرس ظاهرًا مرة واحدة في المتن يجب أن يشير معرّف
      // الشاملة إلى الصفحة نفسها؛ هذا يحرس انزياح القفز صفحتين أو ثلاثًا.
      for (const entry of parsed.toc.slice(0, 40)) {
        const title = entry.title.replace(/\s+/g, ' ').trim()
        if (title.length < 8) continue
        const matches = parsed.pages.filter(page => Math.abs(page.id - entry.id) <= 4 && page.text.replace(/\s+/g, ' ').includes(title))
        if (matches.length === 1) expect(matches[0]!.id, `${name}: ${title}`).toBe(entry.id)
      }
    }
    expect(booksWithStructuredPublishingData).toBeGreaterThan(0)
    // الجرد، لا التخمين: تسجل النتيجة لتوثيق ما إذا كانت العينة نفسها
    // تحمل حواشي صريحة. دعم العرض يُختبر بعقد منفصل ولا نخترع حاشية.
    expect(pagesWithExplicitFootnoteSignals).toBeGreaterThan(0)
  }, 30_000)

  it('splits labelled Betaka fields without losing unknown provenance', () => {
    const metadata = parseBokBetaka('الناشر: دار السلام للطباعة والنشر والتوزيع والترجمة\nالطبعة: الطبعة الأولى، 2009 م (من 1409 هـ)\nالمحقق: أحمد محمد\nملاحظة لا نعرف حقلها')
    expect(metadata.publisher).toBe('دار السلام للطباعة والنشر والتوزيع والترجمة')
    expect(metadata.edition).toBe('الطبعة الأولى، 2009 م (من 1409 هـ)')
    expect(metadata.publicationYearHijri).toBe(1409)
    expect(metadata.investigator).toBe('أحمد محمد')
    expect(metadata.description).toBe('ملاحظة لا نعرف حقلها')
    expect(metadata.rawBetaka).toContain('دار السلام')
  })
})

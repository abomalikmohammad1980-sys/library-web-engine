import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { parseEpub } from './epub_import'

function fixture(href = 'chapter.xhtml'): Uint8Array {
  const opf = `<?xml version="1.0"?><package><metadata><dc:title>كتاب العلم</dc:title><dc:creator>أحمد</dc:creator><dc:publisher>دار المعرفة</dc:publisher><dc:description>وصف الكتاب</dc:description><dc:contributor opf:role="edt">محمد المحقق</dc:contributor><dc:date>1441 هـ</dc:date><meta property="schema:bookEdition">الطبعة الثالثة</meta></metadata><manifest><item id="c1" href="${href}" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>`
  return zipSync({ mimetype: strToU8('application/epub+zip'), 'META-INF/container.xml': strToU8('<container><rootfiles><rootfile full-path="OPS/content.opf"/></rootfiles></container>'), 'OPS/content.opf': strToU8(opf), 'OPS/chapter.xhtml': strToU8('<html><head><title>الباب الأول</title><script>alert(1)</script></head><body><h1>العلم</h1><p>نص عربي</p><a href="https://evil.example">رابط</a></body></html>') })
}

describe('safe EPUB intake', () => {
  it('reads structured OPF metadata and spine text while dropping executable markup', () => { const book = parseEpub(fixture(), 'علم.epub'); expect(book).toMatchObject({ title: 'كتاب العلم', author: 'أحمد', publisher: 'دار المعرفة', edition: 'الطبعة الثالثة', investigator: 'محمد المحقق', publicationYearHijri: 1441, description: 'وصف الكتاب' }); expect(book.text).toContain('نص عربي'); expect(book.text).not.toContain('alert(1)'); expect(book.text).not.toContain('https://') })
  it('rejects external or escaping manifest references', () => { expect(() => parseEpub(fixture('https://evil.example/ch.xhtml'), 'x.epub')).toThrow('خارجي'); expect(() => parseEpub(fixture('../../outside.xhtml'), 'x.epub')).toThrow('خارج') })
  it('requires the EPUB mimetype contract', () => { const bad = zipSync({ mimetype: strToU8('application/zip'), 'META-INF/container.xml': strToU8('<x/>') }); expect(() => parseEpub(bad, 'x.epub')).toThrow('mimetype') })
})

import { describe, expect, it } from 'vitest'
import { buildRichClipboard } from './rich_clipboard'

describe('rich reader clipboard', () => {
  it('preserves paragraph gaps and line breaks in both clipboard formats',()=>{
    const result=buildRichClipboard('فقرة أولى\n\nفقرة ثانية\nسطر ثانٍ','الطريق إلى القرآن')
    expect(result.plain).toContain('فقرة أولى\n\nفقرة ثانية\nسطر ثانٍ')
    expect(result.html).toContain('فقرة أولى<br><br>فقرة ثانية<br>سطر ثانٍ')
  })
  it('provides plain text and semantic RTL HTML with the same citation', () => {
    const payload = buildRichClipboard('قال الله تعالى', 'الكتاب (ص ١٢): المؤلف', '<strong>قال الله</strong> تعالى')
    expect(payload.plain).toBe('«قال الله تعالى»\n[الكتاب (ص ١٢): المؤلف]')
    expect(payload.html).toContain('dir="rtl" lang="ar"')
    expect(payload.html).toContain('<div>«قال الله تعالى»</div>')
    expect(payload.html).toContain('[الكتاب (ص ١٢): المؤلف]')
  })

  it('escapes text and citation when selected HTML is unavailable', () => {
    const payload = buildRichClipboard('<نص & شرح>', 'كتاب "موثق"')
    expect(payload.html).toContain('&lt;نص &amp; شرح&gt;')
    expect(payload.html).toContain('كتاب &quot;موثق&quot;')
  })

  it('keeps guillemets with the paragraph and moves its final period after the closing guillemet', () => {
    const payload = buildRichClipboard('فإن ذلك نص منقول.', 'الكتاب (١ / ٩): المؤلف', '<p>فإن ذلك نص منقول.</p>')
    expect(payload.plain).toBe('«فإن ذلك نص منقول».\n[الكتاب (١ / ٩): المؤلف]')
    expect(payload.html).toContain('<div>«فإن ذلك نص منقول».</div>')
    expect(payload.html).not.toContain('«<p>')
  })
})

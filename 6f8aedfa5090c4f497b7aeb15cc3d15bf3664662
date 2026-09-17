import { describe, expect, it } from 'vitest'
import { buildRichClipboard } from './rich_clipboard'

describe('rich reader clipboard', () => {
  it('provides plain text and semantic RTL HTML with the same citation', () => {
    const payload = buildRichClipboard('قال الله تعالى', 'الكتاب (ص ١٢) — المؤلف', '<strong>قال الله</strong> تعالى')
    expect(payload.plain).toBe('قال الله تعالى\n\n— الكتاب (ص ١٢) — المؤلف')
    expect(payload.html).toContain('dir="rtl" lang="ar"')
    expect(payload.html).toContain('<strong>قال الله</strong> تعالى')
    expect(payload.html).toContain('الكتاب (ص ١٢) — المؤلف')
  })

  it('escapes text and citation when selected HTML is unavailable', () => {
    const payload = buildRichClipboard('<نص & شرح>', 'كتاب "موثق"')
    expect(payload.html).toContain('&lt;نص &amp; شرح&gt;')
    expect(payload.html).toContain('كتاب &quot;موثق&quot;')
  })
})

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('documented memory copy', () => {
  it('uses the shared rich clipboard with book, physical sheet, and author', () => {
    const source = readFileSync(new URL('./screens/notes.ts', import.meta.url), 'utf8')
    expect(source).toContain('writeRichClipboard(buildRichClipboard(item.text, source))')
    expect(source).toContain('`${bookTitle} (الورقة ${item.pageIndex + 1})`')
    expect(source).toContain("annotationActionLabel('copy'")
  })
})

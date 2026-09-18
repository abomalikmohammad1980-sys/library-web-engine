import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('loads formatted PDF generation only within the requested download action', () => {
  const source = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
  expect(source).not.toMatch(/import\s*\{[^}]*openFormattedBookPdf[^}]*\}\s*from/)
  const action = source.slice(source.indexOf('async function downloadConvertedPdf('))
  expect(action).toContain("await import('../formatted_book_pdf')")
  expect(action).toContain('await openFormattedBookPdf(stored)')
})

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('review action accessibility contract', () => {
  it('names repeated review actions with their annotation context', () => {
    const source = readFileSync(new URL('./screens/notes.ts', import.meta.url), 'utf8')
    expect(source).toContain("annotationActionLabel('remembered', label, bookTitle, item.pageIndex + 1)")
    expect(source).toContain("annotationActionLabel('again', label, bookTitle, item.pageIndex + 1)")
  })
})

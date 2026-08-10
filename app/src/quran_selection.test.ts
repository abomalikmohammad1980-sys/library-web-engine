import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { quranWordIndexAtPoint } from './quran_selection'

const word = (left: number, top: number, right = left + 30, bottom = top + 20) => ({
  getBoundingClientRect: () => ({ left, top, right, bottom }),
}) as unknown as HTMLElement

describe('uthmani multi-line selection', () => {
  it('tracks the nearest word across visual lines without vertical DOM-order bias', () => {
    const words = [word(300, 20), word(240, 20), word(300, 70), word(240, 70)]
    expect(quranWordIndexAtPoint(words, 305, 75, () => [])).toBe(2)
    expect(quranWordIndexAtPoint(words, 245, 75, () => [])).toBe(3)
  })

  it('prefers the actual hit word when overlapping ayah boxes expose several candidates', () => {
    const words = [word(0, 0), word(0, 0)]
    const hit = { closest: () => words[1] } as unknown as Element
    expect(quranWordIndexAtPoint(words, 10, 10, () => [hit])).toBe(1)
  })

  it('keeps word click separate and opens all researcher tools only after a drag', () => {
    const source = readFileSync(new URL('./screens/quran.ts', import.meta.url), 'utf8')
    expect(source).toContain('if (moved) {')
    expect(source).toContain('quranWordIndexAtPoint(words')
    for (const label of ['نسخ عثماني', 'نسخ إملائي', 'تظليل', 'في الخِزانة', 'في Google']) expect(source).toContain(label)
    expect(source).toContain('formatQuranCopyRange')
  })
})

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isSunnahLibraryBook } from './screens/sunnah'

describe('Sunnah section', () => {
  it('matches classified hadith books without treating unrelated uses of السنة as a corpus', () => {
    expect(isSunnahLibraryBook({ title: 'شرح صحيح البخاري', category: 'شروح الحديث' })).toBe(true)
    expect(isSunnahLibraryBook({ title: 'نزهة النظر', tags: [{ name: 'مصطلح الحديث', source: 'manual' }] })).toBe(true)
    expect(isSunnahLibraryBook({ title: 'السنة الدراسية الجديدة', category: 'كتب عامة' })).toBe(false)
  })

  it('has a visible route between Quran and the personal library', () => {
    const shell = readFileSync(new URL('./shell.ts', import.meta.url), 'utf8')
    const router = readFileSync(new URL('./router.ts', import.meta.url), 'utf8')
    expect(shell.indexOf("hash: '#/quran'")).toBeLessThan(shell.indexOf("hash: '#/sunnah'"))
    expect(shell.indexOf("hash: '#/sunnah'")).toBeLessThan(shell.indexOf("hash: '#/library'"))
    expect(router).toContain("if (first === 'sunnah') return { name: 'sunnah' }")
    expect(router).toContain("content = appFrame(sunnahScreen(), '#/sunnah')")
  })
})

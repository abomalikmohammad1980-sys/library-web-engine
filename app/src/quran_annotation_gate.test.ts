import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ornamentalVerseRanges } from './textual_quran_style'

const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
const renderer = readFileSync(new URL('./shamela_page_render.ts', import.meta.url), 'utf8')
const styling = readFileSync(new URL('./textual_quran_style.ts', import.meta.url), 'utf8')

describe('conservative Quran annotation gate', () => {
  it('does not classify brace candidates as Quran by punctuation alone', () => {
    expect(reader).toContain('decorateTextParagraph(block.text,')
    expect(renderer).toContain('styleOrnamentalVerses(paragraph)')
    expect(styling).toContain('Presentation only: do not replace source spelling or assert Quran matching.')
    expect(ornamentalVerseRanges('{ليس آية} ﴿غير مكتمل')).toEqual([])
    const ornamental = '﴿نص بين قوسين مزهرين﴾'
    expect(ornamentalVerseRanges(ornamental)).toEqual([{ start: 0, end: ornamental.length }])
  })
})

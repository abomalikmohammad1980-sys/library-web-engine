import { expect, it } from 'vitest'
import { markdownSearchParagraphs } from './markdown_search_paragraphs'
import { textParagraphs } from './text_import'

it('preserves offsets and source text and carries surah/verse headings without fictitious pages', () => {
  const source = '# التفسير\n\n## سورة 3\n\n### الآيات 152–153\n\nالنص ﴿آية﴾\n\n### الآيات 154\n\nبقية التفسير'
  const rows = markdownSearchParagraphs(source)
  expect(rows.map(row => row.text)).toEqual(textParagraphs(source))
  expect(rows[3]).toEqual({ index: 3, text: 'النص ﴿آية﴾', sectionHeading: 'التفسير · سورة 3 · الآيات 152–153' })
  expect(rows[5]?.sectionHeading).toBe('التفسير · سورة 3 · الآيات 154')
  expect(rows.every(row => !('pageLabel' in row) && !('partLabel' in row))).toBe(true)
})

it('does not turn code block comments into book headings', () => {
  const source = '# الباب\n\n```md\n# شيفرة\n\n## ليست عنوانًا\n```\n\nالنص'
  const rows = markdownSearchParagraphs(source)
  expect(rows.map(row => row.text)).toEqual(textParagraphs(source))
  expect(rows.at(-1)?.sectionHeading).toBe('الباب')
})

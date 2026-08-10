/*
 * اختبار جسر العرض — المرحلة 1: فتح كتاب docx حقيقي وتقسيمه صفحات.
 *  المنطق نقّي (لا DOM) فيعمل في node مباشرةً.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { extractFromDocx } from '@engine/ooxml-model'
import { splitPages } from './bridge'

const DOCX = new URL('../../public/books/sample-ahadith.docx', import.meta.url)

describe('bridge — تقسيم صفحات كتاب حقيقي', () => {
  const model = extractFromDocx(readFileSync(DOCX))

  it('ينتج أكثر من صفحة واحدة من علامات كسر الصفحة', () => {
    const pages = splitPages(model)
    expect(pages.length).toBeGreaterThan(1)
  })

  it('كل صفحة تحتوي فقراتٍ نصيةً حقيقية', () => {
    const pages = splitPages(model)
    for (const page of pages) {
      expect(page.paragraphs.length).toBeGreaterThan(0)
      for (const p of page.paragraphs) {
        expect(p.text.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('لا يفقد نصًّا: مجموع نصوص الصفحات يطابق فقرات المتن', () => {
    const pages = splitPages(model)
    const bodyText = model.paragraphs
      .filter((p) => !p.excluded && !p.tableCell && p.text.trim())
      .map((p) => p.text)
      .join('\n')
    const pagedText = pages.map((pg) => pg.paragraphs.map((p) => p.text).join('\n')).join('\n')
    expect(pagedText).toBe(bodyText)
  })
})

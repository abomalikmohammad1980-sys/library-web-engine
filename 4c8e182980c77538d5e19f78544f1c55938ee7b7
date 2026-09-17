import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseEpub } from './epub_import'
import { textParagraphs } from './text_import'

const file = new URL('../../../../كتب للاختبار/الماجريات.epub', import.meta.url)

describe('EPUB Arabic real corpus', () => {
  it('preserves Arabic metadata, RTL text and NCX destinations', () => {
    const parsed = parseEpub(readFileSync(file), 'الماجريات.epub')
    expect(parsed.title).toBe('الماجريات')
    expect(parsed.author).toBe('إبراهيم عمر السكران')
    expect(parsed.publisher).toBe('دار الحضارة للنشر والتوزيع')
    expect(parsed.toc.length).toBeGreaterThan(40)
    const paragraphs = textParagraphs(parsed.text)
    const target = parsed.toc.find(entry => entry.title.includes('التمييز بين فقه الواقع'))
    expect(target).toBeDefined()
    // العنوان مذكور قبل ذلك داخل مقدمة الفصل؛ يجب أن تشير NCX إلى عنصر
    // h2 ذي id الأصلي، لا إلى أول تكرار نصي مبكر.
    expect(paragraphs[target!.paragraphIndex]).toMatch(/^1-التمييز بين فقه الواقع والغرق في الواقع/u)
    expect(target!.level).toBe(2)
    expect(target!.bookmark).toMatch(/^epub-toc-/)
    expect(target!.chapterIndex).toBeGreaterThanOrEqual(0)
    expect(target!.anchor).toBeTruthy()
    expect(parsed.chapters[target!.chapterIndex]?.path).toMatch(/\.x?html?$/i)
    expect(parsed.text).not.toContain('Unknown')
  })
})

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
const css = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')

describe('تصفية الفهرس المشتركة لكل صيغ القارئ', () => {
  it('تخفي العناصر غير المطابقة فعليًا وتعيدها عند المسح', () => {
    expect(reader).toContain('item.el.hidden = !matched')
    expect(reader).toContain("search.value = ''; filter(); search.focus()")
    expect(css).toMatch(/\.reader__toc-item\[hidden\]\s*\{\s*display:\s*none\s*!important;/)
  })

  it('تطبق التصفية في مكوّن الفهرس المشترك لا في صيغة بعينها', () => {
    expect(reader).toContain('function renderTocAside(')
    expect(reader).not.toMatch(/reader--(?:word|pdf|epub|bok)[^{]*reader__toc-item\[hidden\]/)
  })
})

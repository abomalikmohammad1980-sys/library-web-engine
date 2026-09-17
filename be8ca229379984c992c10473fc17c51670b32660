import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { researchProjectDocx } from './research_project_docx'

describe('scientific Word export', () => {
  it('creates a real RTL docx with ordered benefits and escaped citations', () => {
    const bytes = researchProjectDocx({ id: 'p', title: 'بحث <فقهي>', description: 'وصف', annotationIds: ['b'], createdAt: 1, updatedAt: 1 }, [{ id: 'b', kind: 'ملاحظة', text: 'نص & دليل', book: 'كتاب العلم', author: 'المؤلف', page: 7 }])
    const files = unzipSync(bytes), document = strFromU8(files['word/document.xml']!)
    expect(files['[Content_Types].xml']).toBeTruthy(); expect(files['_rels/.rels']).toBeTruthy()
    expect(document).toContain('<w:bidi/>'); expect(document).toContain('بحث &lt;فقهي&gt;'); expect(document).toContain('نص &amp; دليل')
    expect(document).toContain('المصدر: كتاب العلم — المؤلف — الصفحة 7')
  })
})

import { describe, expect, it } from 'vitest'
import { parseReviewedTags, suggestTagsFromHeadings } from './book_tags'

describe('book tags', () => {
  it('suggests useful precise headings and rejects structural noise', () => {
    const tags = suggestTagsFromHeadings([
      { title: 'المقدمة', level: 1 },
      { title: '1- باب توحيد الحاكمية', level: 1, paragraphIndex: 8 },
      { title: 'الفصل الثاني: الولاء والبراء', level: 2, paragraphIndex: 14 },
      { title: 'الخاتمة', level: 1 },
    ])
    expect(tags.map(tag => tag.name)).toEqual(['توحيد الحاكمية', 'الولاء والبراء'])
    expect(tags[0]).toMatchObject({ source: 'toc', paragraphIndex: 8 })
  })

  it('keeps reviewed suggestions and marks new values as manual without duplicates', () => {
    const suggested = suggestTagsFromHeadings([{ title: 'العقيدة الإسلامية', pageId: 4 }])
    expect(parseReviewedTags('العقيدة الإسلامية، فقه الواقع، العقيدة الإسلامية', suggested)).toEqual([
      expect.objectContaining({ name: 'العقيدة الإسلامية', source: 'toc', pageId: 4 }),
      { name: 'فقه الواقع', source: 'manual' },
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { hasAuthorRelations, parseAuthorRelationNames, relationNamesText } from './author_relations'

describe('author scientific relations', () => {
  it('normalizes separators, blanks, and duplicates', () => {
    expect(parseAuthorRelationNames('مالك بن أنس، الشافعي\nمالك  بن أنس; أحمد بن حنبل')).toEqual([
      'مالك بن أنس', 'الشافعي', 'أحمد بن حنبل',
    ])
  })

  it('round-trips stored names and reports meaningful content', () => {
    const teachers = ['نافع مولى ابن عمر', 'الزهري']
    expect(parseAuthorRelationNames(relationNamesText(teachers))).toEqual(teachers)
    expect(hasAuthorRelations({ teachers, students: [] })).toBe(true)
    expect(hasAuthorRelations({ teachers: [], students: [] })).toBe(false)
  })
})

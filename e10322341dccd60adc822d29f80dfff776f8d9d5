import { describe, expect, it } from 'vitest'
import { auditAuthorRelations, type RelationAuthor } from './author_relation_graph'

const base = (value: Partial<RelationAuthor> & Pick<RelationAuthor, 'id' | 'name'>): RelationAuthor => ({ canonicalName: value.name, aliases: [], ...value })

describe('author relation graph audit', () => {
  it('resolves aliases and Arabic variants and verifies the reverse relation', () => {
    const pupil = base({ id: 'pupil', name: 'الإمام الشافعي', aliases: ['الشافعي'], teachers: ['مالك بن أنس'] })
    const teacher = base({ id: 'teacher', name: 'مالك بن أنس', students: ['الامام الشافعي'] })
    expect(auditAuthorRelations(pupil, [pupil, teacher])).toEqual([{ name: 'مالك بن أنس', role: 'teacher', targetId: 'teacher', reciprocal: true }])
  })

  it('keeps unresolved and one-sided relations visible for review', () => {
    const author = base({ id: 'a', name: 'مؤلف', students: ['تلميذ معروف', 'مجهول'] })
    const student = base({ id: 's', name: 'تلميذ معروف' })
    expect(auditAuthorRelations(author, [author, student])).toEqual([
      { name: 'تلميذ معروف', role: 'student', targetId: 's', reciprocal: false },
      { name: 'مجهول', role: 'student', reciprocal: false },
    ])
  })
})

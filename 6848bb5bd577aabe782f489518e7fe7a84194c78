export interface RelationAuthor {
  id: string
  name: string
  canonicalName: string
  aliases: string[]
  teachers?: string[]
  students?: string[]
}

export interface AuditedAuthorRelation {
  name: string
  role: 'teacher' | 'student'
  targetId?: string
  reciprocal: boolean
}

function key(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ar').replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim()
}

function names(author: RelationAuthor): string[] {
  return [author.name, author.canonicalName, ...author.aliases]
}

export function auditAuthorRelations(author: RelationAuthor, catalog: readonly RelationAuthor[]): AuditedAuthorRelation[] {
  const lookup = new Map<string, RelationAuthor>()
  for (const candidate of catalog) for (const name of names(candidate)) if (key(name)) lookup.set(key(name), candidate)
  const audit = (relationName: string, role: 'teacher' | 'student'): AuditedAuthorRelation => {
    const target = lookup.get(key(relationName))
    const reverse = role === 'teacher' ? target?.students : target?.teachers
    const reciprocal = Boolean(reverse?.some(name => names(author).some(own => key(own) === key(name))))
    return { name: relationName, role, ...(target ? { targetId: target.id } : {}), reciprocal }
  }
  return [
    ...(author.teachers ?? []).map(name => audit(name, 'teacher')),
    ...(author.students ?? []).map(name => audit(name, 'student')),
  ]
}

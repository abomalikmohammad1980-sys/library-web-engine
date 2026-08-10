export interface AuthorRelations {
  teachers: string[]
  students: string[]
}

export function parseAuthorRelationNames(value: string): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const item of value.split(/[\n،,؛;]+/)) {
    const name = item.trim().replace(/\s+/g, ' ')
    if (!name) continue
    const key = name.toLocaleLowerCase('ar')
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names
}

export function relationNamesText(names: readonly string[] | undefined): string {
  return (names ?? []).join('\n')
}

export function hasAuthorRelations(relations: Partial<AuthorRelations> | undefined): boolean {
  return Boolean(relations?.teachers?.length || relations?.students?.length)
}

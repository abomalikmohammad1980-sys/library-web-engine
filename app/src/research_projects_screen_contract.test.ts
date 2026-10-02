import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('research projects screen contract', () => {
  it('routes a real workspace from Me and links persisted annotations', () => {
    const router = readFileSync(new URL('./router.ts', import.meta.url), 'utf8'), me = readFileSync(new URL('./screens/me.ts', import.meta.url), 'utf8'), screen = readFileSync(new URL('./screens/research_projects.ts', import.meta.url), 'utf8')
    expect(router).toContain("first === 'research-projects'")
    expect(me).toContain("'#/research-projects'")
    expect(screen).toContain('updateResearchProject(project.id, [...selected])')
    expect(screen).toContain("renderBoundUiTemplate('c381f7f82fd61735',{p1:project.title}")
    expect(screen).toContain('.sort((a, b) => compareBooksByAuthorDeath(')
    expect(screen).toContain('for (const [projectIndex, project] of projects.entries())')
    expect(screen).toContain('benefits.map((item, index) =>')
    expect(screen).toContain('ordinal = bookOrdinal(index)')
    expect(screen).toContain('`#/reader/${book.id}?pageIndex=${item.pageIndex}`')
    expect(screen).toContain('authorLink(book.author, undefined, book.authorId)')
    expect(screen).toContain('categoryLink(effectiveBookCategory(book))')
  })
})

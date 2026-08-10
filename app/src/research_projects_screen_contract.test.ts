import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('research projects screen contract', () => {
  it('routes a real workspace from Me and links persisted annotations', () => {
    const router = readFileSync(new URL('./router.ts', import.meta.url), 'utf8'), me = readFileSync(new URL('./screens/me.ts', import.meta.url), 'utf8'), screen = readFileSync(new URL('./screens/research_projects.ts', import.meta.url), 'utf8')
    expect(router).toContain("first === 'research-projects'")
    expect(me).toContain("'#/research-projects'")
    expect(screen).toContain('updateResearchProject(project.id, [...selected])')
    expect(screen).toContain('لن تُحذف الملاحظات والتظليلات')
  })
})

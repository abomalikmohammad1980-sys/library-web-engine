import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createResearchProject, deleteResearchProject, listResearchProjects, removeAnnotationFromProjects, updateResearchProject } from './research_project'

describe('research projects', () => {
  const values = new Map<string, string>()
  beforeEach(() => { values.clear(); vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }) })
  it('creates, links unique benefits, cleans deleted annotations and deletes independently', () => {
    expect(() => createResearchProject('   ')).toThrow('عنوان')
    const project = createResearchProject('أصول الترجيح', 'جمع الأدلة', 10)
    expect(updateResearchProject(project.id, ['n1', 'n1', 'h1'], 20).annotationIds).toEqual(['n1', 'h1'])
    removeAnnotationFromProjects('n1')
    expect(listResearchProjects()[0]?.annotationIds).toEqual(['h1'])
    deleteResearchProject(project.id); expect(listResearchProjects()).toEqual([])
  })
})

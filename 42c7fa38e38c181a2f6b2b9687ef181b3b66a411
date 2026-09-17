import { describe, expect, it } from 'vitest'
import { routeDocumentTitle } from './navigation_accessibility'

describe('route accessibility contract', () => {
  it('gives major destinations distinct Arabic document titles', () => {
    const routes = ['home', 'library', 'authors', 'search', 'shelves', 'settings'] as const
    const titles = routes.map(routeDocumentTitle)
    expect(new Set(titles).size).toBe(titles.length)
    expect(titles.every(title => title.endsWith('— الخِزانة'))).toBe(true)
  })

  it('names reader and author destinations explicitly', () => {
    expect(routeDocumentTitle('reader')).toContain('قراءة الكتاب')
    expect(routeDocumentTitle('author')).toContain('رف المؤلف')
  })
})


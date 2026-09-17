import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = (path: string): string => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const asyncStateOwners = ['./screens/home.ts', './screens/me.ts', './screens/book.ts', './screens/notes.ts', './screens/reader.ts', './book_import.ts']
const auditedSources = [...asyncStateOwners, './live_search.ts']

describe('unified async state contract', () => {
  it('uses stateView in every screen that owns async loading or failure states', () => {
    // live_search صار محوّلًا متزامنًا إلى شاشة البحث المركزية؛ لا يملك
    // تحميلًا أو خطأً أو حالة فراغ كي يركّب stateView وهميًا.
    for (const path of asyncStateOwners) {
      expect(source(path), path).toContain('stateView')
    }
  })

  it('does not reintroduce the retired ad-hoc state classes', () => {
    const combined = auditedSources.map(source).join('\n')
    for (const className of ['home-state--error', 'home-recent__loading', 'me-loading', 'book-page-loading', 'notes-loading', 'notes-empty', 'live-search__status', 'live-search__error', 'live-search__empty', 'reader__pdf-loading', 'reading__error', 'annotation-empty', 'search-loading']) {
      expect(combined).not.toContain(className)
    }
  })
})

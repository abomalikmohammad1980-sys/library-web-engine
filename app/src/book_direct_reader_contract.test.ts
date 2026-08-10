import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('direct book reading routes', () => {
  it('opens ordinary library and shelf book links in the reader', () => {
    const library = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    const shelves = readFileSync(new URL('./screens/shelves.ts', import.meta.url), 'utf8')
    expect(library).toContain('href: `#/reader/${book.id}`')
    expect(library).not.toContain('href: `#/book/${book.id}`')
    expect(shelves).toContain('href: `#/reader/${book.id}`')
  })

  it('keeps legacy book URLs compatible by routing them directly to the reader', () => {
    const router = readFileSync(new URL('./router.ts', import.meta.url), 'utf8')
    expect(router).toContain("if (first === 'book' && second) return { name: 'reader', param: second }")
    expect(router).not.toContain('content = appFrame(bookScreen(')
  })
})

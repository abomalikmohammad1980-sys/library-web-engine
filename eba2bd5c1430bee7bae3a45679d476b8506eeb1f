import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')

describe('BOK and EPUB exact TOC destinations', () => {
  it('mounts stable bookmarks on BOK headings and uses them from TOC', () => {
    expect(source).toContain('id: entry.bookmark')
    expect(source).toContain('bookmark: `bok-toc-${index + 1}`')
  })

  it('mounts EPUB/text heading ids and passes bookmarks to navigation', () => {
    expect(source).toContain("id: heading.bookmark ?? `text-heading-${offset + relative}`")
    expect(source).toContain('primaryBookmark.get(entry.paragraphIndex)!')
    expect(source).toContain('nav.goToBookmark?.(item.bookmark)')
  })
})

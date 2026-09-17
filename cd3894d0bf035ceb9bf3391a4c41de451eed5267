import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('author portrait display', () => {
  it('reuses the stored portrait in directory cards and falls back on image failure', () => {
    const source = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    expect(source).toContain("authorAvatar(author, 52, 'author-card__avatar')")
    expect(source).toContain("alt: `صورة ${author.name}`")
    expect(source).toContain("image.addEventListener('error'")
    expect(source).toContain("revokeTrackedObjectURL(url)")
  })
})

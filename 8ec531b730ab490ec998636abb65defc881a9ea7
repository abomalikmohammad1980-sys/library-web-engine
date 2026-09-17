import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('annotation deletion confirmation', () => {
  it('guards deletion from both the memory screen and reader panel', () => {
    const notes = readFileSync(new URL('./screens/notes.ts', import.meta.url), 'utf8')
    const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
    expect(notes).toContain('if (!confirm(annotationDeletePrompt(')
    expect(reader.match(/if \(!confirm\(annotationDeletePrompt\(/g)).toHaveLength(2)
  })
})

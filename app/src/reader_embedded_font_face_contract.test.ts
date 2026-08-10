import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('reader embedded font face contract', () => {
  it('uses the declared Word family and preserves style and weight descriptors', () => {
    const source = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
    expect(source).toContain('const data = new Uint8Array(face.data)')
    expect(source).toContain("face.family?.trim() || extractFontFamily(data)")
    expect(source).toContain('{ style: face.style, weight: face.weight }')
    expect(source).not.toContain("{ style: 'normal', weight: 'normal' }")
  })
})

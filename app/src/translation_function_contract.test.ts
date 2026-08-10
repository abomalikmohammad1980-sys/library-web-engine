import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Cloudflare translation function', () => {
  const source = readFileSync(resolve(import.meta.dirname, '../../alpha-publish/functions/api/translate.js'), 'utf8')

  it('validates method, content type, language and text size', () => {
    expect(source).toContain('onRequestPost')
    expect(source).toContain('application/json')
    expect(source).toContain('LANGUAGES.has(target)')
    expect(source).toContain('text.length > 6000')
  })

  it('uses a dedicated translation model and a reviewed fallback without client secrets', () => {
    expect(source).toContain("@cf/meta/m2m100-1.2b")
    expect(source).toContain("SPECIAL_LLM_LANGUAGES.has(target)")
    expect(source).toContain("reviewed: false")
    expect(source).not.toMatch(/api[_-]?key|bearer\s/i)
  })
})

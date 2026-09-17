import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const settings = readFileSync(new URL('./screens/settings.ts', import.meta.url), 'utf8')
const library = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
const helper = readFileSync(new URL('./programmatic_file_input.ts', import.meta.url), 'utf8')

describe('programmatic file picker accessibility', () => {
  it('removes button-driven file inputs from focus and the accessibility tree', () => {
    expect(helper).toContain('input.hidden = true')
    expect(helper).toContain('input.tabIndex = -1')
    expect(helper).toContain("input.setAttribute('aria-hidden', 'true')")
  })

  it('uses the shared contract for settings and author catalog pickers without visually-hidden duplicates', () => {
    expect(settings).toContain('makeProgrammaticFileInput(')
    expect(library).toContain('makeProgrammaticFileInput(')
    expect(`${settings}\n${library}`).not.toMatch(/class:\s*['"]visually-hidden['"],\s*type:\s*['"]file['"]/) 
  })
})

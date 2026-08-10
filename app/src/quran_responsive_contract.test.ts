import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const CSS = readFileSync(new URL('./styles/screens.css', import.meta.url), 'utf8')
const SCREEN = readFileSync(new URL('./screens/quran.ts', import.meta.url), 'utf8')

describe('Quran three-column responsive contract', () => {
  it('keeps the canonical desktop order and prevents children crossing grid tracks at 1440px', () => {
    expect(CSS).toContain("grid-template-areas: 'tools mushaf tafsir'")
    expect(CSS).toContain('.quran-reader__layout > *')
    expect(CSS).toContain('min-inline-size: 0')
    expect(CSS).toContain('.quran-mushaf { grid-area: mushaf; min-width: 0; overflow: hidden; }')
  })

  it('uses a safe two-column tablet stage and one column at 768px', () => {
    expect(CSS).toContain('@media (max-width: 1280px)')
    expect(CSS).toContain("grid-template-areas: 'tools mushaf' 'tafsir tafsir'")
    expect(CSS).toContain('@media (max-width: 820px)')
    expect(CSS).toContain("grid-template-areas: 'mushaf' 'tools' 'tafsir'")
  })

  it('stacks the tafsir selector and contains cards at 390px', () => {
    expect(CSS).toContain('@media (max-width: 520px)')
    expect(CSS).toContain('.quran-tafsir-selector { grid-template-columns: minmax(0, 1fr); }')
    expect(CSS).toContain('.quran-inspector, .quran-mushaf { border-radius: 16px; }')
  })

  it('keeps semantic sidebars separate from the central mushaf', () => {
    expect(SCREEN).toContain("class: 'quran-inspector quran-inspector--tools'")
    expect(SCREEN).toContain("class: 'quran-mushaf'")
    expect(SCREEN).toContain("class: 'quran-inspector quran-inspector--tafsir'")
  })
})

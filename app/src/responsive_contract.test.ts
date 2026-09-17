import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const components = readFileSync(fileURLToPath(new URL('./styles/components.css', import.meta.url)), 'utf8')
const screens = readFileSync(fileURLToPath(new URL('./styles/screens.css', import.meta.url)), 'utf8')

describe('responsive shell contract', () => {
  it('keeps primary tap targets at least 44px and mobile navigation larger', () => {
    expect(components).toMatch(/\.btn\s*\{[^}]*min-height:\s*44px/s)
    expect(components).toMatch(/\.btn--icon\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s)
    expect(components).toMatch(/\.pager-btn\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s)
    expect(components).toMatch(/\.bottom-nav button\s*\{[^}]*min-height:\s*56px/s)
  })

  it('stacks author controls at tablet width and library filters at narrow mobile width', () => {
    expect(screens).toMatch(/@media \(max-width:\s*900px\)[^{]*\{[^}]*\.authors-controls[^}]*flex-direction:\s*column/s)
    expect(screens).toMatch(/@media \(max-width:\s*400px\)[^{]*\{[^}]*\.library-controls__advanced[^}]*grid-template-columns:\s*1fr/s)
  })

  it('retains one-column search controls and author cards on phones', () => {
    expect(screens).toMatch(/@media \(max-width:\s*560px\)[^{]*\{[^}]*\.search-form[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s)
    expect(screens).toContain('@media (max-width: 620px)')
    expect(screens).toContain('.authors-grid { grid-template-columns: 1fr; }')
  })

  it('keeps reader identity legible in the one-line phone status bar', () => {
    expect(components).toMatch(/\.reading__identity\s*\{[^}]*overflow:\s*hidden/s)
    expect(components).toMatch(/\.reading__author-link\s*\{[^}]*display:\s*inline-block/s)
    expect(components).toMatch(/@media \(max-width:\s*560px\)[^{]*\{[\s\S]*?\.reading__identity\s*\{[^}]*flex:\s*1 1 122px;[^}]*max-width:\s*142px/s)
    expect(components).not.toContain("content: 'انتقال سريع'")
  })

  it('keeps companion comparison beside text on tablets and non-overlapping on narrow phones', () => {
    expect(components).toMatch(/@media \(max-width:\s*1024px\)[^{]*\{[\s\S]*?\.reader__body--pdf-companion\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s)
    expect(components).toMatch(/@media \(max-width:\s*1024px\)[^{]*\{[\s\S]*?\.reader__body--pdf \.reader__info--pdf\s*\{[^}]*position:\s*sticky;[^}]*inset-block:\s*65px auto;[^}]*inset-inline:\s*auto;[^}]*width:\s*100%;[^}]*height:\s*calc\(100dvh - 122px\)/s)
    const phone=components.lastIndexOf('@media (max-width: 768px)')
    expect(phone).toBeGreaterThan(components.indexOf('@media (max-width: 1024px)'))
    expect(components.slice(phone)).toMatch(/\.reader__body--pdf\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s)
    expect(components.slice(phone)).toMatch(/\.reader__body--pdf \.reader__info--pdf\s*\{[^}]*position:\s*relative;[^}]*inset:\s*auto;[^}]*inline-size:\s*100%/s)
  })

  it('keeps multi-part page jump controls on the single phone status line', () => {
    expect(components).toMatch(/@media \(max-width:\s*420px\)[^{]*\{[\s\S]*?\.reading__position\s*\{[^}]*width:\s*calc\(100% - 8px\);[^}]*gap:\s*3px/s)
    expect(components).toMatch(/@media \(max-width:\s*420px\)[^{]*\{[\s\S]*?\.reading__page-jump\s*\{[^}]*min-width:\s*0;[^}]*flex:\s*1 1 112px;[^}]*overflow:\s*hidden/s)
    expect(components).toMatch(/@media \(max-width:\s*420px\)[^{]*\{[\s\S]*?\.reading__page-jump select\s*\{[^}]*width:\s*40px;[^}]*min-width:\s*0/s)
  })

  it('gives the in-book search field a full phone row without hiding navigation', () => {
    expect(components).toMatch(/@media \(max-width:\s*640px\)[^{]*\{[\s\S]*?\.reader__search-head\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/s)
    expect(components).toMatch(/@media \(max-width:\s*640px\)[^{]*\{[\s\S]*?\.reader__search-bar input\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*width:\s*100%/s)
    expect(components).toMatch(/\.reader__search-close\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s)
  })

  it('turns the opaque book card into a bounded bottom sheet on phones', () => {
    expect(components).toMatch(/@media \(max-width:\s*600px\)[^{]*\{[\s\S]*?\.reader__book-card\s*\{[^}]*align-items:\s*end;[^}]*padding:\s*10px/s)
    expect(components).toMatch(/@media \(max-width:\s*600px\)[^{]*\{[\s\S]*?\.reader__book-card-panel\s*\{[^}]*max-height:\s*91dvh;[^}]*padding:\s*var\(--space-4\)/s)
    expect(components).toMatch(/@media \(max-width:\s*600px\)[^{]*\{[\s\S]*?\.reader__book-card \.reader__metadata\s*\{[^}]*grid-template-columns:\s*1fr/s)
  })
})

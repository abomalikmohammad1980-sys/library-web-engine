import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname)
const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8')

describe('settings functional and navigation contract', () => {
  it('exposes an accessible settings route beside the account control', () => {
    const source = read('shell.ts')
    expect(source).toContain("class: 'app-header__settings'")
    expect(source).toContain("href: '#/settings'")
    expect(source).toContain("'aria-label': 'فتح الإعدادات'")
    expect(source.indexOf('inner.appendChild(settings)')).toBeLessThan(source.indexOf('inner.appendChild(account)'))
  })

  it('keeps every visible settings action wired to persistence or an explicit gateway', () => {
    const source = read('screens/settings.ts')
    for (const action of [
      "interfaceRange.input.addEventListener('input', commit)",
      "readerRange.input.addEventListener('input', commit)",
      "contrast.input.addEventListener('change', commit)",
      "motion.input.addEventListener('change', commit)",
      "reset.addEventListener('click'",
      "exportButton.addEventListener('click'",
      "exportLibrary.addEventListener('click'",
      "archiveImport.addEventListener('click'",
      "importButton.addEventListener('click'",
    ]) expect(source).toContain(action)
    expect(source).toContain('connectAppSourceSync(gateway, render)')
    expect(source).toContain("routeEventListener(window, 'online', render")
    expect(source).toContain("routeEventListener(window, 'offline', render")
  })

  it('centers the about brand responsively and preserves focus/forced-colors styling', () => {
    const screens = read('styles/screens.css')
    const components = read('styles/components.css')
    expect(screens).toMatch(/\.settings-about \{[^}]*justify-items: center[^}]*text-align: center/s)
    expect(screens).toMatch(/\.settings-about__brand \{[^}]*margin-inline: auto/s)
    expect(components).toContain('.app-header__settings:focus-visible')
    expect(components).toMatch(/@media \(forced-colors: active\)[\s\S]*\.app-header__settings/)
  })
})

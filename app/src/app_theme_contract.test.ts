import { beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSettings, resetSettings, saveSettings } from './settings_store'

const root = path.resolve(import.meta.dirname)
const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8')

describe('whole-app theme contract', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key), clear: () => values.clear(),
    } })
    const attrs = new Map<string, string>()
    const documentElement = {
      dataset: {} as Record<string, string>, style: { colorScheme: '', setProperty: () => undefined },
      classList: { toggle: () => undefined },
      removeAttribute: (key: string) => attrs.delete(key),
    }
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement, querySelector: () => null } })
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } })
  })

  it('migrates missing and invalid values to the original default', () => {
    expect(getSettings().theme).toBe('original')
    localStorage.setItem('alkhizana:settings:v1', JSON.stringify({ theme: 'unknown' }))
    expect(getSettings().theme).toBe('original')
  })

  it.each(['original', 'light', 'dark', 'sepia'] as const)('persists and reapplies %s', theme => {
    saveSettings({ interfaceScale: 100, readerScale: 100, highContrast: false, reduceMotion: false, theme })
    expect(getSettings().theme).toBe(theme)
    expect(document.documentElement.dataset.appTheme).toBe(theme)
    expect(document.documentElement.style.colorScheme).toBe(theme === 'dark' ? 'dark' : 'light')
  })

  it('reset restores the original theme', () => {
    saveSettings({ interfaceScale: 100, readerScale: 100, highContrast: false, reduceMotion: false, theme: 'dark' })
    expect(resetSettings().theme).toBe('original')
    expect(document.documentElement.dataset.appTheme).toBe('original')
  })

  it('prevents flash and exposes a clear header selector without altering source pages', () => {
    const html = read('../index.html'), shell = read('shell.ts'), tokens = read('styles/tokens.css'), components = read('styles/components.css'), screens = read('styles/screens.css')
    expect(html).toContain("document.documentElement.dataset.appTheme = theme")
    expect(shell).toContain("'aria-label': 'اختيار ألوان الخِزانة'")
    for (const theme of ['light', 'dark', 'sepia']) expect(tokens).toContain(`[data-app-theme='${theme}']`)
    expect(tokens.lastIndexOf("[data-app-theme='dark']")).toBeGreaterThan(tokens.indexOf(':root {'))
    expect(tokens.slice(tokens.lastIndexOf("[data-app-theme='dark']"))).toContain('--paper-bg: #0d0f0d')
    expect(tokens.slice(tokens.lastIndexOf("[data-app-theme='light']"))).toContain('--paper-surface: #fff')
    expect(tokens.slice(tokens.lastIndexOf("[data-app-theme='sepia']"))).toContain('--paper-bg: #e5d2b0')
    expect(tokens).not.toMatch(/\[data-app-theme='dark'\][\s\S]{0,1000}(filter:\s*invert|\.reading__page-slot)/)
    expect(shell).toContain("role: 'menuitemradio'")
    expect(shell).toContain("theme.open = false")
    expect(components).toMatch(/@media \(max-width: 640px\)[\s\S]*\.app-header__theme-menu \{ position: fixed/)
    expect(components).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))")
    expect(screens).toContain("[data-app-theme='dark'] .daily-card")
    expect(screens).toMatch(/\[data-app-theme='dark'\] \.home-hero__brand,[\s\S]*background: var\(--paper-surface\);[\s\S]*color: var\(--text-body\);/)
    expect(screens).toMatch(/\[data-app-theme='dark'\] \.continue-card[\s\S]*var\(--paper-surface-alt\)/)
  })

  it('keeps the reader book card opaque and theme-aware in all four app themes', () => {
    const tokens = read('styles/tokens.css'), components = read('styles/components.css')
    for (const theme of ['light', 'dark', 'sepia']) {
      const block = tokens.slice(tokens.lastIndexOf(`[data-app-theme='${theme}']`))
      expect(block).toMatch(/--paper-surface:\s*#[0-9a-f]+/i)
      expect(block).toMatch(/--paper-surface-alt:\s*#[0-9a-f]+/i)
    }
    const panel = components.match(/\.reader__book-card-panel\s*\{(?<body>[\s\S]*?)\n\}/)?.groups?.body ?? ''
    expect(panel).toContain('background: var(--paper-surface)')
    expect(panel).not.toMatch(/background[^;]*transparent/)
    expect(panel).not.toMatch(/opacity\s*:/)
    expect(components).toContain('.reader__book-card .reader__metadata > div')
    expect(components).toContain('background: var(--paper-surface-alt)')
  })
})

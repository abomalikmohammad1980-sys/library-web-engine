import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const screen = readFileSync(new URL('./screens/settings.ts', import.meta.url), 'utf8')
const shell = readFileSync(new URL('./shell.ts', import.meta.url), 'utf8')
const base = readFileSync(new URL('./styles/base.css', import.meta.url), 'utf8')
const screens = readFileSync(new URL('./styles/screens.css', import.meta.url), 'utf8')

describe('settings end-to-end UI contract', () => {
  it('wires every appearance control to immediate persistence', () => {
    for (const wire of ['interfaceRange.input', 'readerRange.input', 'contrast.input', 'motion.input', 'theme.input']) expect(screen).toContain(`${wire}.addEventListener`)
    expect(screen).toContain('saveSettings(settings)')
    expect(screen).toContain('resetSettings()')
  })

  it('keeps the header theme display synchronized with settings-page changes and reset', () => {
    expect(shell).toContain("'alkhizana:settings-changed'")
    expect(shell).toContain('updateThemeControl(')
    expect(shell).toContain('item.dataset.theme === value')
  })

  it('preserves readable high contrast for all distinct themes', () => {
    for (const theme of ['dark', 'light', 'sepia']) expect(base).toContain(`[data-app-theme='${theme}'].a11y-high-contrast`)
  })

  it('centers the logo and exposes accessible gear/account controls', () => {
    expect(screens).toMatch(/\.settings-about \{[^}]*justify-items: center[^}]*text-align: center/s)
    expect(shell).toContain("icon('settings', 20)")
    expect(shell).toContain("'aria-label': 'فتح الإعدادات'")
    expect(shell.indexOf('inner.appendChild(settings)')).toBeLessThan(shell.indexOf('inner.appendChild(account)'))
  })
})

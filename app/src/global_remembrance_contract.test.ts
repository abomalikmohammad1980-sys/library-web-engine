import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { REMEMBRANCES, chooseRemembrance, remembranceWordCount } from './remembrances'

describe('global remembrance', () => {
  it('is mounted once by the router so it also reaches the reader route', () => {
    const shell = readFileSync(new URL('./shell.ts', import.meta.url), 'utf8')
    const router = readFileSync(new URL('./router.ts', import.meta.url), 'utf8')
    expect(shell).toContain('export function globalRemembrance')
    expect(shell).toContain("reminder.classList.add('is-leaving')")
    expect(shell).toContain('10_000')
    expect(shell).toContain("khizana:remembrance-shown:v2")
    expect(shell).toContain("'aria-live': 'polite'")
    expect(shell).toContain("'aria-atomic': 'true'")
    expect(router).toContain('root.replaceChildren(content, globalRemembrance())')
  })

  it('keeps a broad sourced corpus of complete reminders under ten words', () => {
    expect(REMEMBRANCES.length).toBeGreaterThanOrEqual(80)
    expect(new Set(REMEMBRANCES.map(entry => entry.id)).size).toBe(REMEMBRANCES.length)
    for (const entry of REMEMBRANCES) {
      expect(remembranceWordCount(entry.text), entry.text).toBeLessThanOrEqual(10)
      if (entry.kind === 'authentic-remembrance') {
        expect(entry.sourceUrl).toMatch(/^https:\/\/dorar\.net\/azkar/)
        expect(entry.sourceLabel).toContain('الدرر السنية')
      } else {
        expect(entry.sourceUrl).toBeNull()
        expect(entry.sourceLabel).toContain('غير منسوب إلى حديث')
      }
    }
  })

  it('labels public prayers separately from sourced remembrances', () => {
    expect(REMEMBRANCES.some(entry => entry.kind === 'authentic-remembrance')).toBe(true)
    expect(REMEMBRANCES.some(entry => entry.kind === 'general-prayer')).toBe(true)
    expect(REMEMBRANCES.filter(entry => entry.kind === 'general-prayer').every(entry => entry.sourceUrl === null)).toBe(true)
  })

  it('avoids the most recently shown reminders', () => {
    const values = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } })
    const first = chooseRemembrance(() => 0), second = chooseRemembrance(() => 0)
    expect(second.id).not.toBe(first.id)
  })
})

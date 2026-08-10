import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const counter = readFileSync(new URL('./visitor_counter.ts', import.meta.url), 'utf8')
const shell = readFileSync(new URL('./shell.ts', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')

describe('privacy-preserving visitor counter', () => {
  it('uses the same-origin API and remains hidden on failures or unverified payloads', () => {
    expect(counter).toContain("const VISITORS_ENDPOINT = '/api/visitors'")
    expect(counter).toContain("credentials: 'same-origin'")
    expect(counter).toContain('if (!response.ok) return')
    expect(counter).toContain('if (!validTotal(total) || !element.isConnected) return')
    expect(counter).not.toContain('localStorage')
    expect(counter).not.toContain('fingerprint')
  })

  it('mounts only inside the non-reader site footer', () => {
    expect(shell).toContain("import { visitorCounter } from './visitor_counter'")
    expect(shell).toContain('visitorCounter()')
    expect(shell).toContain('frame.appendChild(siteFooter())')
    expect(styles).toContain('.site-footer__visitor-count')
    expect(styles).toContain('.site-footer__visitor-count { display: none !important; }')
  })
})

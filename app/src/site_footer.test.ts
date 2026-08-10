import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const shell = readFileSync(new URL('./shell.ts', import.meta.url), 'utf8')
const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')

describe('compact public site footer', () => {
  it('is mounted by the non-reader application frame only', () => {
    expect(shell).toContain('frame.appendChild(siteFooter())')
    expect(reader).not.toContain('siteFooter')
    expect(shell).toContain("brandMark('site-footer__mark brand-mark')")
  })

  it('links only to active routes and safe named Telegram destinations', () => {
    for (const route of ['#/library', '#/search', '#/authors', '#/shelves', '#/settings']) expect(shell).toContain(route)
    expect(shell).toContain('https://t.me/khezana1448')
    expect(shell).toContain('https://t.me/khezaana')
    expect(shell.match(/rel: 'noopener noreferrer'/g)).toHaveLength(2)
    expect(shell).toContain('حقوق النشر محفوظة لكل مسلم، وكل خدماتنا مجانية في سبيل الله: طلب العلم فريضة، فانشر تُؤجر')
    expect(shell).not.toContain('بشرط استعمالها في مصالح المسلمين')
    expect(shell).not.toContain('فإنَّ طلب العلم فريضة لكل مسلم')
  })

  it('stays compact at 360px, keyboard-visible, forced-color safe and absent from print', () => {
    expect(styles).toContain('@media (max-width: 420px)')
    expect(styles).toContain('.site-footer a:focus-visible')
    expect(styles).toContain('@media (forced-colors: active)')
    expect(styles).toContain('.site-footer { display: none !important; }')
  })
})

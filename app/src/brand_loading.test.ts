import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('lets the browser select one logo resource and retains monochrome print and forced-colors', () => {
  const source = readFileSync(new URL('./brand.ts', import.meta.url), 'utf8')
  expect(source.match(/decorativeImage\(/g)).toHaveLength(1)
  expect(source).toContain("h('picture'")
  expect(source).toContain("media = 'print, (forced-colors: active)'")
  expect(source).toContain("srcset = '/brand-logo-mono.png'")
  expect(source).toContain("'/brand-logo-color.webp'")
  expect(source).toContain('brand-logo-color-small.webp?inline')
  expect(source).toContain('welcome__hero-mark|reader__text-title-logo')
  const css = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')
  expect(css).toContain('brand-logo-mono-small.webp?inline')
  expect(css).toContain('.book-cover__brand > picture { visibility:hidden; }')
})

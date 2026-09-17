import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../public')
const source = (path: string): string => readFileSync(resolve(import.meta.dirname, path), 'utf8')
const png = (path: string): Buffer => readFileSync(resolve(root, path))

describe('official Alkhizana brand artwork', () => {
  it('ships the supplied color master and monochrome fallback as real PNG assets', () => {
    const color = png('brand-logo-color.png')
    const mono = png('brand-logo-mono.png')
    expect(color.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(mono.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(color.length).toBeGreaterThan(20_000)
    expect(mono.length).toBeGreaterThan(5_000)
    expect(color.equals(mono)).toBe(false)
  })

  it('uses the official mark in header, welcome, install, forced colors and print', () => {
    expect(source('./brand.ts')).toContain("'./brand-logo-color.png'")
    expect(source('./brand.ts')).toContain("'./brand-logo-mono.png'")
    expect(source('./shell.ts')).toContain("brandMark('app-logo__mark brand-mark')")
    expect(source('./screens/welcome.ts')).toContain("brandMark('welcome__brand-mark brand-mark')")
    expect(source('./screens/welcome.ts')).toContain("brandMark('welcome__hero-mark brand-mark')")
    expect(source('./screens/me.ts')).toContain("brandMark('me-install__brand brand-mark')")
    expect(source('./screens/settings.ts')).toContain("brandMark('settings-about__brand brand-mark')")
    expect(source('./book_cover.ts')).toContain("brandMark('book-cover__brand brand-mark')")
    expect(source('./quote_card.ts')).toContain("brand-logo-share.png?inline")
    expect(source('./quote_card.ts')).toContain('<image href="${brandLogoUrl}"')
    expect(source('./icons.ts')).not.toContain("logo: '<path")
    const css = source('./styles/components.css')
    expect(css).toContain('@media (forced-colors: active)')
    expect(css).toContain('.brand-mark__mono { display: block')
    expect(css).toContain("url('/brand-logo-mono.png')")
  })

  it('declares the regenerated artwork for browser, Apple and offline install surfaces', () => {
    const html = source('../index.html')
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.webmanifest'), 'utf8')) as { icons: Array<{ src: string }> }
    const sw = readFileSync(resolve(root, 'sw.js'), 'utf8')
    expect(html).toContain('./favicon-64.png')
    expect(html).toContain('./icons/apple-touch-icon.png')
    expect(manifest.icons).toHaveLength(4)
    for (const icon of manifest.icons) expect(png(icon.src.replace('./', '')).length).toBeGreaterThan(1_000)
    for (const asset of ['brand-logo-color.png', 'brand-logo-mono.png', 'favicon-64.png', 'icons/apple-touch-icon.png']) expect(sw).toContain(asset)
  })
})

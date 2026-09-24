import {selectCoverCandidate} from '@library/word-cover'
import { describe, expect, it } from 'vitest'
import { COVER_PALETTES, coverTitleFit, deterministicCoverHue, deterministicCoverPalette, deterministicCoverTemplate } from './book_cover'

function luminance(hex: string): number {
  const values = hex.slice(1).match(/.{2}/g)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return .2126 * values[0]! + .7152 * values[1]! + .0722 * values[2]!
}
function contrast(a: string, b: string): number { const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (light! + .05) / (dark! + .05) }

describe('book cover selection', () => {
  it('prefers a prominent first-page cover over a small logo', () => {
    const cover = selectCoverCandidate([
      { mediaPath: 'media/logo.png', width: 900, height: 300, pageWidth: 12000, pageHeight: 17000, inline: true },
      { mediaPath: 'media/cover.jpg', width: 8500, height: 14000, pageWidth: 12000, pageHeight: 17000, inline: false },
    ])
    expect(cover?.mediaPath).toBe('media/cover.jpg')
  })

  it('rejects small or banner-shaped images', () => {
    expect(selectCoverCandidate([{ mediaPath: 'media/banner.png', width: 9000, height: 1200, pageWidth: 12000, pageHeight: 17000, inline: false }])).toBeUndefined()
  })

  it('keeps fallback colors deterministic', () => {
    expect(deterministicCoverHue('كتاب|مؤلف')).toBe(deterministicCoverHue('كتاب|مؤلف'))
    expect(deterministicCoverTemplate('كتاب|مؤلف')).toBe(deterministicCoverTemplate('كتاب|مؤلف'))
    expect(deterministicCoverTemplate('كتاب|مؤلف')).toBeGreaterThanOrEqual(0)
    expect(deterministicCoverTemplate('كتاب|مؤلف')).toBeLessThan(4)
  })

  it('offers ten deterministic palettes keyed by book id', () => {
    expect(COVER_PALETTES).toHaveLength(10)
    const palettes = new Set(Array.from({ length: 200 }, (_, index) => deterministicCoverPalette(`shamela-${index + 1}`)))
    expect([...palettes].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(deterministicCoverPalette('shamela-8')).toBe(deterministicCoverPalette('shamela-8'))
  })

  it('meets WCAG contrast for every foreground pairing in every palette', () => {
    for (const palette of COVER_PALETTES) {
      expect(contrast(palette.titleForeground, palette.titleBackground)).toBeGreaterThanOrEqual(3)
      for (const background of [palette.backgroundA, palette.backgroundB]) {
        expect(contrast(palette.authorForeground, background)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(palette.metadataForeground, background)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(palette.accent, background)).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrast(palette.logoForeground, palette.logoBackground)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('reduces type size without truncating long Arabic titles', () => {
    expect(coverTitleFit('الأم')).toBe(12)
    expect(coverTitleFit('شرح طويل جدًا '.repeat(14))).toBe(7)
  })
})

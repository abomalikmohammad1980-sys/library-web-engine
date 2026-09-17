import { describe, expect, it } from 'vitest'
import { deterministicCoverHue, deterministicCoverTemplate, selectCoverCandidate } from './book_cover'

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
})

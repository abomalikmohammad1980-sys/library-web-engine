import { describe, expect, it } from 'vitest'
import { hasAuthoritativeWordPageMaps } from './reader_page_authority'

describe('reader Word page authority', () => {
  const map = { totalPages: 41, paragraphCount: 686, starts: [{ paragraphIndex: 0, physicalPage: 1, adjustedPage: 1 }] }
  it('requires a documented map for every part', () => {
    expect(hasAuthoritativeWordPageMaps([map], 1)).toBe(true)
    expect(hasAuthoritativeWordPageMaps([undefined], 1)).toBe(false)
    expect(hasAuthoritativeWordPageMaps([map, undefined], 2)).toBe(false)
  })
})

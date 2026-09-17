import { describe, expect, it } from 'vitest'
import { parseReaderDeepLink, readyReaderTotal, readerIndexForDisplayedPage, readerProgressState, requestedReaderPage } from './reader_navigation'

describe('reader deep links', () => {
  const pages = (count: number) => Array.from({ length: count }, () => ({ matches: () => false, querySelector: () => null }))
  it('does not turn an absent paragraph parameter into paragraph zero', () => {
    expect(parseReaderDeepLink('pageIndex=5')).toEqual({ pageIndex: 5 })
    expect(requestedReaderPage(parseReaderDeepLink('pageIndex=5'), pages(10))).toBe(5)
  })

  it('preserves an exact Quran tafsir origin in the reader deep link', () => {
    expect(parseReaderDeepLink('surah=8&ayah=1')).toEqual({ surah: 8, ayah: 1 })
    expect(parseReaderDeepLink('surah=0&ayah=no')).toEqual({})
  })

  it('rejects empty and invalid indexes while clamping a valid page index', () => {
    expect(parseReaderDeepLink('para=&pageIndex=no')).toEqual({})
    expect(requestedReaderPage(parseReaderDeepLink('pageIndex=50'), pages(6))).toBe(5)
  })

  it('maps TOC and jump labels through displayed Word page numbers without off-by-one assumptions', () => {
    expect(readerIndexForDisplayedPage([4, 5, 6, 7], 6)).toBe(2)
    expect(readerIndexForDisplayedPage([4, 5, 6, 7], 9)).toBe(3)
  })

  it('uses rendered physical slots for the ready total instead of a stale preview label', () => {
    expect(readyReaderTotal(72)).toBe(72)
    expect(readyReaderTotal(0)).toBe(0)
  })

  it('never presents a one-page preview as a completed one-page book', () => {
    expect(readerProgressState(0, 1, true)).toEqual({ loading: true, complete: false })
  })

  it('uses a trusted stored physical total throughout preview then rendered slots when ready', () => {
    expect(readerProgressState(0, 1, true, 72)).toEqual({
      total: 72,
      percent: 1,
      remainingMinutes: 107,
      loading: false,
      complete: false,
    })
    expect(readerProgressState(0, 72, false, 72)).toEqual({
      total: 72,
      percent: 1,
      remainingMinutes: 107,
      loading: false,
      complete: false,
    })
    expect(readerProgressState(71, 72, false, 72)).toEqual({
      total: 72,
      percent: 100,
      remainingMinutes: 0,
      loading: false,
      complete: true,
    })
  })

  it('does not trust an invalid or smaller physical total during preview', () => {
    expect(readerProgressState(2, 1, true, 1)).toEqual({ loading: true, complete: false })
    expect(readerProgressState(0, 1, true, 0)).toEqual({ loading: true, complete: false })
  })
})

import { describe, expect, it } from 'vitest'
import { availableReaderPage, parseReaderDeepLink, readyReaderTotal, readerEstimatedSlotHeight, readerHydrationWindow, readerIndexForDisplayedPage, readerProgressState, readerSlotAtViewportCenter, requestedReaderPage } from './reader_navigation'

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

  it('keeps a deep Word page pending instead of clamping it to the first progressive batch', () => {
    const link = parseReaderDeepLink('pageIndex=11')
    expect(availableReaderPage(link, pages(5))).toBe(-1)
    expect(availableReaderPage(link, pages(12))).toBe(11)
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

  it('hydrates bounded first, middle and last windows without gaps', () => {
    expect(readerHydrationWindow(0, 1000, 0)).toEqual([0, 1, 2])
    expect(readerHydrationWindow(500, 1000, 0)).toEqual([498, 499, 500, 501, 502])
    expect(readerHydrationWindow(999, 1000, 0)).toEqual([997, 998, 999])
  })

  it('prefetches farther in the active direction while staying weak-device bounded', () => {
    expect(readerHydrationWindow(500, 1000, -1)).toEqual([496, 497, 498, 499, 500, 501, 502])
    expect(readerHydrationWindow(500, 1000, 1)).toEqual([498, 499, 500, 501, 502, 503, 504])
    expect(readerHydrationWindow(500, 100_000, 1)).toHaveLength(7)
  })
  it('bounds a giant textual book below the browser paint limit without changing ordinary books',()=>{
    expect(readerEstimatedSlotHeight(960,894)).toBe(960)
    expect(readerEstimatedSlotHeight(960,10766)).toBe(Math.floor(6_000_000/10766))
    expect(readerEstimatedSlotHeight(960,10766)*10766).toBeLessThanOrEqual(6_000_000)
  })
  it('locates a deep page with logarithmic layout reads and handles gaps and edges',()=>{
    let reads=0
    const rectAt=(index:number)=>{reads++;return{top:index*120,bottom:index*120+100}}
    expect(readerSlotAtViewportCenter(10_767,8497*120+50,rectAt)).toBe(8497)
    expect(reads).toBeLessThan(20)
    expect(readerSlotAtViewportCenter(10_767,-20,rectAt)).toBe(0)
    expect(readerSlotAtViewportCenter(10_767,2_000_000,rectAt)).toBe(10_766)
    expect(readerSlotAtViewportCenter(10_767,5*120+110,rectAt)).toBe(6)
  })
})
// Volume-qualified paragraphs must wait for their own progressive page.
it('keeps a second-volume target pending and preserves old unqualified links',()=>{
 const first={matches:(s:string)=>s==='[data-part-number="1"]',querySelector:(s:string)=>s==='[data-idx="0"]'?{}:null},second={matches:(s:string)=>s==='[data-part-number="2"]',querySelector:first.querySelector}
 expect(availableReaderPage(parseReaderDeepLink('?para=0&volumeIndex=1'),[first])).toBe(-1)
 expect(availableReaderPage(parseReaderDeepLink('?para=0&volumeIndex=1'),[first,second])).toBe(1)
 expect(availableReaderPage(parseReaderDeepLink('?para=0'),[first,second])).toBe(0)
})

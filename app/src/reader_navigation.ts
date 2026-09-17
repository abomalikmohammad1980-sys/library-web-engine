export interface ReaderDeepLink { paragraphIndex?: number; pageIndex?: number; volumeIndex?:number; surah?: number; ayah?: number }

function optionalNonNegativeInteger(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key)
  if (raw === null || raw.trim() === '') return undefined
  const value = Number(raw)
  return Number.isInteger(value) && value >= 0 ? value : undefined
}

export function parseReaderDeepLink(query: string): ReaderDeepLink {
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query)
  const paragraphIndex = optionalNonNegativeInteger(params, 'para')
  const pageIndex = optionalNonNegativeInteger(params, 'pageIndex')
  const volumeIndex=optionalNonNegativeInteger(params,'volumeIndex')
  const surah = optionalNonNegativeInteger(params, 'surah')
  const ayah = optionalNonNegativeInteger(params, 'ayah')
  return { ...(paragraphIndex === undefined ? {} : { paragraphIndex }), ...(pageIndex === undefined ? {} : { pageIndex }), ...(volumeIndex===undefined?{}:{volumeIndex}), ...(surah ? { surah } : {}), ...(ayah ? { ayah } : {}) }
}

export interface ReaderPageLike { matches(selector: string): boolean; querySelector(selector: string): unknown }

export function requestedReaderPage(link: ReaderDeepLink, pages: readonly ReaderPageLike[]): number {
  if (link.paragraphIndex !== undefined) {
    const selector = `[data-idx="${link.paragraphIndex}"]`
    return pages.findIndex(page => (link.volumeIndex===undefined||page.matches(`[data-part-number="${link.volumeIndex+1}"]`))&&(page.matches(selector) || Boolean(page.querySelector(selector))))
  }
  if (link.pageIndex !== undefined) return Math.min(link.pageIndex, Math.max(0, pages.length - 1))
  return -1
}

/**
 * أثناء ترسيم Word التدريجي لا يجوز قصّ رابط صفحة لم تصل بعد إلى آخر صفحة
 * متاحة؛ ترجع -1 كي يبقى الهدف معلّقًا حتى تُلحق الدفعة التي تحتويه.
 */
export function availableReaderPage(link: ReaderDeepLink, pages: readonly ReaderPageLike[]): number {
  if (link.pageIndex !== undefined && link.pageIndex >= pages.length) return -1
  return requestedReaderPage(link, pages)
}

/** يحول رقم الصفحة الظاهر في Word/الفهرس إلى فهرس فتحة القارئ، ولا يفترض أن الرقم يبدأ من 1. */
export function readerIndexForDisplayedPage(pageNumbers: readonly number[], displayedPage: number): number {
  const exact = pageNumbers.findIndex(value => value === displayedPage)
  if (exact >= 0) return exact
  return Math.max(0, Math.min(displayedPage - 1, Math.max(0, pageNumbers.length - 1)))
}

export function readyReaderTotal(renderedPageCount: number): number {
  return Number.isInteger(renderedPageCount) && renderedPageCount > 0 ? renderedPageCount : 0
}

/** نافذة ترطيب صغيرة حول الصفحة المرئية، مع سبق أكبر في اتجاه التمرير. */
export function readerHydrationWindow(center: number, total: number, direction: -1 | 0 | 1): number[] {
  if (!Number.isInteger(total) || total <= 0) return []
  const safe = Math.max(0, Math.min(Math.trunc(center), total - 1))
  const behind = direction < 0 ? 4 : 2
  const ahead = direction > 0 ? 4 : 2
  const indexes: number[] = []
  for (let index = Math.max(0, safe - behind); index <= Math.min(total - 1, safe + ahead); index++) indexes.push(index)
  return indexes
}

export interface ReaderProgressState {
  total?: number
  percent?: number
  remainingMinutes?: number
  loading: boolean
  complete: boolean
}

/**
 * لا يجوز اعتبار الورقة الوحيدة في المعاينة كتابًا من صفحة واحدة. نستعمل العدد
 * الفيزيائي المحفوظ فقط عندما يكون صالحًا، وإلا نظل في حالة تحميل صادقة حتى
 * يكتمل الترسيم وتصبح الصفحات المرسومة هي المرجع.
 */
export function readerProgressState(
  currentIndex: number,
  renderedPageCount: number,
  preview: boolean,
  physicalPageCount?: number,
): ReaderProgressState {
  const current = Math.max(1, Math.floor(currentIndex) + 1)
  const trustedPhysicalTotal = Number.isInteger(physicalPageCount) && Number(physicalPageCount) >= current
    ? Number(physicalPageCount)
    : undefined
  const total = preview ? trustedPhysicalTotal : readyReaderTotal(renderedPageCount)
  if (!total) return { loading: true, complete: false }
  const percent = Math.max(1, Math.min(100, Math.round((current / total) * 100)))
  const remainingMinutes = Math.max(0, Math.ceil((total - current) * 1.5))
  return { total, percent, remainingMinutes, loading: false, complete: current >= total }
}

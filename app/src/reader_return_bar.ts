import { icon } from './icons'
import { h } from './ui'
import {uiTemplateText,uiTemplateAttribute} from './ui_template_binding'
import {readingStorageKey} from './reading_identity_scope'

export const READER_RETURN_STORAGE_KEY = 'alkhizana:reader-return-stack:v1'
const MAX_RETURN_POINTS = 8

export interface ReaderReturnPoint {
  bookId: string
  title: string
  pageIndex: number
  savedAt: number
}

function browserSessionStorage(): Storage | undefined {
  try { return typeof sessionStorage === 'undefined' ? undefined : sessionStorage }
  catch { return undefined }
}

export function readReaderReturnStack(storage = browserSessionStorage()): ReaderReturnPoint[] {
  if (!storage) return []
  try {
    const parsed = JSON.parse(storage.getItem(readingStorageKey(READER_RETURN_STORAGE_KEY)) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ReaderReturnPoint => {
      if (!item || typeof item !== 'object') return false
      const point = item as Partial<ReaderReturnPoint>
      return typeof point.bookId === 'string' && Boolean(point.bookId)
        && typeof point.title === 'string'
        && Number.isInteger(point.pageIndex) && Number(point.pageIndex) >= 0
        && Number.isFinite(point.savedAt)
    }).slice(-MAX_RETURN_POINTS)
  } catch { return [] }
}

export function rememberReaderReturnPoint(
  point: Omit<ReaderReturnPoint, 'savedAt'> & { savedAt?: number },
  storage = browserSessionStorage(),
): void {
  if (!storage || !point.bookId || !Number.isInteger(point.pageIndex) || point.pageIndex < 0) return
  const next: ReaderReturnPoint = {
    bookId: point.bookId,
    title: point.title.trim() || 'الكتاب المفتوح',
    pageIndex: point.pageIndex,
    savedAt: point.savedAt ?? Date.now(),
  }
  const stack = readReaderReturnStack(storage).filter(saved => saved.bookId !== next.bookId)
  stack.push(next)
  try { storage.setItem(readingStorageKey(READER_RETURN_STORAGE_KEY), JSON.stringify(stack.slice(-MAX_RETURN_POINTS))) }
  catch { /* التخزين مساعد، ولا يجوز أن يعطل القراءة في الوضع الخاص. */ }
}

export function latestReaderReturnPoint(storage = browserSessionStorage()): ReaderReturnPoint | undefined {
  return readReaderReturnStack(storage).at(-1)
}
export function dismissReaderReturnBar(storage=browserSessionStorage()):void {
  const point=latestReaderReturnPoint(storage)
  if(point)try{storage?.setItem(readingStorageKey(`${READER_RETURN_STORAGE_KEY}:dismissed`),JSON.stringify(point))}catch{/* optional UI state */}
}
export function isReaderReturnBarDismissed(storage=browserSessionStorage()):boolean {
  try{return storage?.getItem(readingStorageKey(`${READER_RETURN_STORAGE_KEY}:dismissed`))===JSON.stringify(latestReaderReturnPoint(storage))}catch{return false}
}

export function readerReturnHref(point: Pick<ReaderReturnPoint, 'bookId' | 'pageIndex'>): string {
  return `#/reader/${encodeURIComponent(point.bookId)}?pageIndex=${point.pageIndex}`
}

export function readerReturnBar(storage = browserSessionStorage()): HTMLElement | undefined {
  const point = latestReaderReturnPoint(storage)
  if (!point || isReaderReturnBarDismissed(storage)) return undefined
  const link=h('a', {
    class: 'return-bar__link',
    href: readerReturnHref(point),
  },
  icon('arrow-back', 17),
  h('span', { class: 'return-bar__label' }, 'عودة إلى موضعك'),
  h('strong', { class: 'return-bar__title', title: point.title, dataset:{noTranslate:''} }, point.title),
  h('span', { class: 'return-bar__page' }, uiTemplateText('e95fdd861149fc31',{p1:point.pageIndex+1})))
  uiTemplateAttribute(link,'aria-label','5ba22c8c112e844a',{p1:point.title,p2:point.pageIndex+1})
  const close=h('button',{type:'button',class:'return-bar__close','aria-label':'إخفاء شريط العودة للقراءة',title:'إخفاء الشريط دون حذف موضع القراءة'},'×')
  const bar=h('div',{class:'return-bar'},link,close)
  close.addEventListener('click',()=>{dismissReaderReturnBar(storage);bar.remove()})
  return bar
}

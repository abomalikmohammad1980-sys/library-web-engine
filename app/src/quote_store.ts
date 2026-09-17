import {captureReadingIdentity} from './reading_identity_scope'
export interface ReaderQuote { id: string; text: string; bookId: string; createdAt: number; pageIndex?:number }
const KEY = 'alkhizana:quotes:v1'

export function getReaderQuotes(identity = captureReadingIdentity()): ReaderQuote[] {
  try { const value = JSON.parse(identity.getItem(KEY) ?? '[]'); return Array.isArray(value) ? value : [] } catch { return [] }
}

export function addReaderQuote(text: string, bookId: string, identity = captureReadingIdentity(), pageIndex?:number): ReaderQuote {
  if (!identity.isCurrent()) throw new Error('quote_identity_changed')
  if(pageIndex!==undefined&&(!Number.isSafeInteger(pageIndex)||pageIndex<0))throw Error('quote_page_invalid')
  const quote = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: text.trim(), bookId, createdAt: Date.now(),...(pageIndex!==undefined?{pageIndex}:{}) }
  saveReaderQuotes([quote, ...getReaderQuotes(identity)], identity)
  return quote
}

export function saveReaderQuotes(quotes: ReaderQuote[], identity = captureReadingIdentity()): void {
  if (!identity.setItem(KEY, JSON.stringify(quotes.slice(0, 500)))) throw new Error('quote_identity_changed')
}

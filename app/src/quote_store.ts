export interface ReaderQuote { id: string; text: string; bookId: string; createdAt: number }
const KEY = 'alkhizana:quotes:v1'

export function getReaderQuotes(): ReaderQuote[] {
  try { const value = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(value) ? value : [] } catch { return [] }
}

export function addReaderQuote(text: string, bookId: string): ReaderQuote {
  const quote = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: text.trim(), bookId, createdAt: Date.now() }
  localStorage.setItem(KEY, JSON.stringify([quote, ...getReaderQuotes()].slice(0, 500)))
  return quote
}

export function saveReaderQuotes(quotes: ReaderQuote[]): void {
  localStorage.setItem(KEY, JSON.stringify(quotes.slice(0, 500)))
}

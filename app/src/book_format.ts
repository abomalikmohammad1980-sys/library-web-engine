export type BookFormat = 'word' | 'pdf' | 'jpeg' | 'shamela-bok' | 'epub' | 'markdown' | 'text' | 'html'
export interface FormatCapabilities { readable: boolean; searchable: boolean | 'when-text-layer'; preservesSourceLayout: boolean; toc: boolean | 'when-present'; status: 'available' | 'planned' }
export const BOOK_FORMATS: Record<BookFormat, { label: string; capabilities: FormatCapabilities }> = {
  word: { label: 'Word', capabilities: { readable: true, searchable: true, preservesSourceLayout: true, toc: 'when-present', status: 'available' } },
  pdf: { label: 'PDF', capabilities: { readable: true, searchable: 'when-text-layer', preservesSourceLayout: true, toc: 'when-present', status: 'available' } },
  jpeg: { label: 'JPG', capabilities: { readable: true, searchable: false, preservesSourceLayout: true, toc: false, status: 'available' } },
  'shamela-bok': { label: 'الشاملة BOK', capabilities: { readable: true, searchable: true, preservesSourceLayout: true, toc: true, status: 'available' } },
  epub: { label: 'EPUB', capabilities: { readable: true, searchable: true, preservesSourceLayout: false, toc: 'when-present', status: 'available' } },
  markdown: { label: 'Markdown', capabilities: { readable: true, searchable: true, preservesSourceLayout: false, toc: 'when-present', status: 'available' } },
  html: { label: 'HTML', capabilities: { readable: true, searchable: true, preservesSourceLayout: false, toc: 'when-present', status: 'available' } },
  text: { label: 'نص', capabilities: { readable: true, searchable: true, preservesSourceLayout: false, toc: false, status: 'available' } },
}
export function inferBookFormat(book: { sourceFormat?: BookFormat; fileName?: string; mimeType?: string }): BookFormat {
  const name = (book.fileName ?? '').toLocaleLowerCase(); const mime = (book.mimeType ?? '').toLocaleLowerCase()
  // نفحص الامتداد أولًا للمكتبات القديمة التي خزنت Markdown بصيغة text.
  if (name.endsWith('.md') || mime.includes('markdown')) return 'markdown'
  if (/\.html?$/u.test(name) || mime.startsWith('text/html')) return 'html'
  if (book.sourceFormat) return book.sourceFormat
  if (/\.jpe?g$/u.test(name) || mime === 'image/jpeg') return 'jpeg'
  if (name.endsWith('.pdf') || mime.includes('pdf')) return 'pdf'
  if (name.endsWith('.bok')) return 'shamela-bok'
  if (name.endsWith('.epub') || mime.includes('epub')) return 'epub'
  if (name.endsWith('.txt') || mime.startsWith('text/')) return 'text'
  return 'word'
}
export function formatLabel(book: { sourceFormat?: BookFormat; fileName?: string; mimeType?: string }): string { return BOOK_FORMATS[inferBookFormat(book)].label }
/** Sources routed to the text/DOM reader, never to the Word ZIP parser. */
export function isTextualReaderFormat(format:BookFormat):boolean{return format==='text'||format==='markdown'||format==='epub'||format==='html'||format==='shamela-bok'}

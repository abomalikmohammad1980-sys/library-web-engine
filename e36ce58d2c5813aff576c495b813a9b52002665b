export type BookFormat = 'word' | 'pdf' | 'shamela-bok' | 'epub' | 'markdown' | 'text'
export interface FormatCapabilities { readable: boolean; searchable: boolean | 'when-text-layer'; preservesSourceLayout: boolean; toc: boolean | 'when-present'; status: 'available' | 'planned' }
export const BOOK_FORMATS: Record<BookFormat, { label: string; capabilities: FormatCapabilities }> = {
  word: { label: 'Word', capabilities: { readable: true, searchable: true, preservesSourceLayout: true, toc: 'when-present', status: 'available' } },
  pdf: { label: 'PDF', capabilities: { readable: true, searchable: 'when-text-layer', preservesSourceLayout: true, toc: 'when-present', status: 'available' } },
  'shamela-bok': { label: 'الشاملة BOK', capabilities: { readable: true, searchable: true, preservesSourceLayout: true, toc: true, status: 'available' } },
  epub: { label: 'EPUB', capabilities: { readable: true, searchable: true, preservesSourceLayout: false, toc: 'when-present', status: 'available' } },
  markdown: { label: 'Markdown', capabilities: { readable: true, searchable: true, preservesSourceLayout: false, toc: 'when-present', status: 'available' } },
  text: { label: 'نص', capabilities: { readable: true, searchable: true, preservesSourceLayout: false, toc: false, status: 'available' } },
}
export function inferBookFormat(book: { sourceFormat?: BookFormat; fileName?: string; mimeType?: string }): BookFormat {
  const name = (book.fileName ?? '').toLocaleLowerCase(); const mime = (book.mimeType ?? '').toLocaleLowerCase()
  // نفحص الامتداد أولًا للمكتبات القديمة التي خزنت Markdown بصيغة text.
  if (name.endsWith('.md') || mime.includes('markdown')) return 'markdown'
  if (book.sourceFormat) return book.sourceFormat
  if (name.endsWith('.pdf') || mime.includes('pdf')) return 'pdf'
  if (name.endsWith('.bok')) return 'shamela-bok'
  if (name.endsWith('.epub') || mime.includes('epub')) return 'epub'
  if (name.endsWith('.txt') || mime.startsWith('text/')) return 'text'
  return 'word'
}
export function formatLabel(book: { sourceFormat?: BookFormat; fileName?: string; mimeType?: string }): string { return BOOK_FORMATS[inferBookFormat(book)].label }

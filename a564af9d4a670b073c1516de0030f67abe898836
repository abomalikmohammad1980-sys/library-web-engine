/* بيانات تجريبية — كتاب واحد حقيقي فقط، والباقي يُرفع يدويًا */
export type CategoryId = 'hadith'

export interface Book {
  id: string
  title: string
  author: string
  docx?: string
}

export const CATEGORIES = [
  { id: 'hadith' as CategoryId, name: 'تجربة المحرك' },
]

const DEMO_BOOK: Book = {
  id: 'hadith-1',
  title: 'عينية المعارف (تجربة المحرك)',
  author: 'كتاب تجريبي — محرك ooxml-model',
  docx: '/books/sample-ahadith.docx',
}

export const BOOKS: Book[] = [DEMO_BOOK]

export function bookById(id: string): Book | undefined {
  return BOOKS.find((b) => b.id === id)
}

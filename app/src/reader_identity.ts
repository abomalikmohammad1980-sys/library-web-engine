const SITE_NAME = 'الخِزانة'

export function readerDocumentTitle(bookTitle?: string): string {
  const title = bookTitle?.trim() || 'قراءة الكتاب'
  return `${title} — ${SITE_NAME}`
}

export function readerIdentityLabel(bookTitle?: string, author?: string): string {
  const title = bookTitle?.trim() || 'كتاب بدون عنوان'
  const authorName = author?.trim() || 'مؤلف غير معروف'
  return `${title} — ${authorName}`
}

export function libraryBookTitleId(bookId: string): string {
  let hash = 2166136261
  for (const char of bookId) { hash ^= char.codePointAt(0) ?? 0; hash = Math.imul(hash, 16777619) }
  return `library-book-title-${(hash >>> 0).toString(36)}`
}

export function libraryBookActionLabel(action: 'select' | 'delete', title: string): string {
  return `${action === 'select' ? 'تحديد' : 'حذف'} ${title.trim() || 'الكتاب'}`
}

export function annotationTitleId(id: string): string {
  let hash = 2166136261
  for (const char of id) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619) }
  return `annotation-${(hash >>> 0).toString(36)}-title`
}

export function annotationActionLabel(action: 'delete' | 'download' | 'copy' | 'remembered' | 'again' | 'dueNow', kind: string, book: string, page: number): string {
  const verb = action === 'delete' ? 'حذف' : action === 'copy' ? 'نسخ موثّق' : action === 'remembered' ? 'تذكرت' : action === 'again' ? 'مراجعة قريبة' : action === 'dueNow' ? 'تقديم مراجعة اليوم' : 'تنزيل بطاقة'
  return `${verb} ${kind} من ${book}، صفحة ${page}`
}

export function annotationDeletePrompt(kind: string, page: number, book?: string): string {
  return `حذف ${kind}${book ? ` من «${book}»` : ''} في الصفحة ${page}؟ لا يمكن التراجع عن هذا الحذف.`
}

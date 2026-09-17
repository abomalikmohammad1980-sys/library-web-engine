import type { StoredBook } from './engine/library_store'
import { inferBookFormat } from './book_format'

export interface ReaderQualityFact {
  kind: 'source' | 'text' | 'original' | 'pdf' | 'conversion'
  label: string
}

export interface ReaderQualitySummary {
  facts: ReaderQualityFact[]
  note: string
}

/**
 * وصف محافظ لما نعرفه من السجل فعلًا. لا يحوّل غياب القياس إلى ادعاء
 * «نص كامل» أو «تحويل مطابق»، فهذه الحالات تحتاج دليلاً صريحًا في البيانات.
 */
export function readerQualitySummary(book: StoredBook): ReaderQualitySummary {
  const format = inferBookFormat(book)
  const facts: ReaderQualityFact[] = []

  if (book.sourceCitation) facts.push({ kind: 'source', label: 'إحالة المصدر محفوظة' })
  else if (book.managedSource === 'published') facts.push({ kind: 'source', label: 'نسخة منشورة من الخزانة' })
  else facts.push({ kind: 'source', label: 'ملف محلي أضافه المستخدم' })

  if (format === 'pdf') facts.push({ kind: 'text', label: 'عرض مباشر من PDF الأصلي' })
  else if (format === 'shamela-bok' && book.bokPages?.length) facts.push({ kind: 'text', label: `نص BOK متاح (${book.bokPages.length} صفحة مسجلة)` })
  else if (format === 'word' && book.readerModel) facts.push({ kind: 'text', label: 'نص Word مفكك للقراءة' })
  else if (format === 'text' || format === 'markdown') facts.push({ kind: 'text', label: 'نص مباشر' })
  else if (format === 'epub' && book.extractedText) facts.push({ kind: 'text', label: 'نص EPUB مستخرج للقراءة' })
  else facts.push({ kind: 'text', label: 'اكتمال النص غير متحقق' })

  if (book.data?.byteLength || book.sourceData?.byteLength) facts.push({ kind: 'original', label: 'الأصل محفوظ على هذا الجهاز' })

  if (format === 'pdf' || book.pdfData?.byteLength) facts.push({ kind: 'pdf', label: 'نسخة PDF متاحة' })
  else facts.push({ kind: 'pdf', label: 'لا توجد نسخة PDF مرفقة' })

  if (format === 'word' && book.wordPageMap) facts.push({ kind: 'conversion', label: 'خريطة صفحات Word مرفقة' })
  else if (format === 'word') facts.push({ kind: 'conversion', label: 'مطابقة الصفحات غير متحققة' })
  else if (format === 'shamela-bok' && book.bokTextVersion) facts.push({ kind: 'conversion', label: `محول BOK — إصدار ${book.bokTextVersion}` })

  return {
    facts,
    note: 'يعرض هذا البيان ما تثبته بيانات الكتاب فقط؛ ولا يعني غياب القياس وجود نقص في الأصل.',
  }
}

const hiddenKey = (bookId: string): string => `alkhizana:reader-quality:hidden:${bookId}`

export function createReaderQualityBar(book: StoredBook): HTMLElement {
  const summary = readerQualitySummary(book)
  const root = document.createElement('aside')
  root.className = 'reader-quality'
  root.setAttribute('aria-label', 'بيان جودة مصدر الكتاب')

  const content = document.createElement('div')
  content.className = 'reader-quality__content'
  const heading = document.createElement('strong')
  heading.className = 'reader-quality__title'
  heading.textContent = 'بيان المصدر'
  const list = document.createElement('ul')
  list.className = 'reader-quality__facts'
  for (const fact of summary.facts) {
    const item = document.createElement('li')
    item.dataset.kind = fact.kind
    item.textContent = fact.label
    list.appendChild(item)
  }
  const note = document.createElement('p')
  note.className = 'reader-quality__note'
  note.textContent = summary.note
  content.append(heading, list, note)

  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'reader-quality__toggle'
  const setHidden = (hidden: boolean): void => {
    root.classList.toggle('reader-quality--hidden', hidden)
    toggle.textContent = hidden ? 'بيان المصدر' : 'إخفاء'
    toggle.setAttribute('aria-expanded', String(!hidden))
    toggle.setAttribute('aria-label', hidden ? 'إظهار بيان جودة مصدر الكتاب' : 'إخفاء بيان جودة مصدر الكتاب')
    try { sessionStorage.setItem(hiddenKey(book.id), hidden ? '1' : '0') } catch { /* وضع خاص أو تخزين معطل */ }
  }
  toggle.addEventListener('click', () => setHidden(!root.classList.contains('reader-quality--hidden')))
  root.append(content, toggle)
  let initiallyHidden = false
  try { initiallyHidden = sessionStorage.getItem(hiddenKey(book.id)) === '1' } catch { /* يبقى ظاهرًا */ }
  setHidden(initiallyHidden)
  return root
}

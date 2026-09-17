import type { StoredBook } from './engine/library_store'
import { inferBookFormat } from './book_format'

export type BulkBokResult = { id: string; title: string; status: 'converted' | 'ineligible' | 'failed' | 'cancelled'; message: string; outputId?: string }

export interface BulkBokDependencies {
  convert(book: StoredBook): Promise<{ data: Uint8Array; fileName: string }>
  save(book: StoredBook, output: { data: Uint8Array; fileName: string }): Promise<string>
}

export function bulkBokEligibility(book: StoredBook): string | undefined {
  if (book.managedSource === 'published') return 'كتاب منشور محمي لا تُنشأ منه نسخة إدارية'
  if (inferBookFormat(book) !== 'word') return 'التحويل الجماعي إلى BOK متاح لكتب Word المستوردة فقط'
  if (!book.data?.length) return 'ملف Word الأصلي غير متاح'
  return undefined
}

/** متسلسل لتفادي ضغط الذاكرة؛ كل نتيجة مستقلة ولا يُعدّل السجل الأصلي. */
export async function bulkConvertBooksToBok(books: readonly StoredBook[], dependencies: BulkBokDependencies, options: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}): Promise<BulkBokResult[]> {
  const results: BulkBokResult[] = []
  for (const book of books) {
    if (options.signal?.aborted) {
      results.push({ id: book.id, title: book.title, status: 'cancelled', message: 'أُلغي قبل بدء التحويل' })
      options.onProgress?.(results.length, books.length)
      continue
    }
    const reason = bulkBokEligibility(book)
    if (reason) results.push({ id: book.id, title: book.title, status: 'ineligible', message: reason })
    else {
      try {
        const output = await dependencies.convert(book)
        if (options.signal?.aborted) results.push({ id: book.id, title: book.title, status: 'cancelled', message: 'أُلغي قبل حفظ النسخة' })
        else results.push({ id: book.id, title: book.title, status: 'converted', message: 'أُنشئت نسخة BOK وبقي الأصل كما هو', outputId: await dependencies.save(book, output) })
      } catch (error) {
        results.push({ id: book.id, title: book.title, status: 'failed', message: error instanceof Error ? error.message : 'تعذّر التحويل' })
      }
    }
    options.onProgress?.(results.length, books.length)
  }
  return results
}

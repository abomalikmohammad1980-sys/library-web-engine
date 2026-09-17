export interface ReaderTocEntry { num: number; label: string; bookmark?: string }
export interface PdfOutlineItem { title?: string; dest?: string | unknown[] | null; items?: PdfOutlineItem[] }
export interface PdfOutlineDocument { getOutline(): Promise<PdfOutlineItem[] | null>; getDestination(name: string): Promise<unknown[] | null>; getPageIndex(ref: unknown): Promise<number> }

export function normalizeTocQuery(value: string): string {
  return value.normalize('NFKC').replace(/ـ/gu, '').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/gu, '').replace(/[أإآٱ]/gu, 'ا').replace(/ى/gu, 'ي').replace(/ؤ/gu, 'و').replace(/ئ/gu, 'ي').replace(/[٠-٩۰-۹]/gu, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit) >= 0 ? '٠١٢٣٤٥٦٧٨٩'.indexOf(digit) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/\s+/gu, ' ').trim().toLocaleLowerCase('ar')
}

export async function extractPdfOutline(document: PdfOutlineDocument): Promise<ReaderTocEntry[]> {
  const outline = await document.getOutline()
  if (!outline?.length) return []
  const result: ReaderTocEntry[] = []
  const visit = async (items: PdfOutlineItem[], parents: string[] = []): Promise<void> => {
    for (const item of items) {
      const title = item.title?.trim()
      const destination = typeof item.dest === 'string' ? await document.getDestination(item.dest) : Array.isArray(item.dest) ? item.dest : null
      if (title && destination?.[0]) {
        try {
          const pageIndex = typeof destination[0] === 'number' ? destination[0] : await document.getPageIndex(destination[0])
          result.push({ num: pageIndex + 1, label: [...parents, title].join(' ← ') })
        } catch { /* وجهة غير قابلة للحل؛ لا نخمن من النص */ }
      }
      if (item.items?.length) await visit(item.items, title ? [...parents, title] : parents)
    }
  }
  await visit(outline)
  return result
}

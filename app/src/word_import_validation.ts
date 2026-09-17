import type { WordPageMap } from './engine/library_store'

interface WordImportPart { data: Uint8Array; wordPageMap?: WordPageMap }
interface WordImportBook extends WordImportPart { volumes?: Array<WordImportPart & { number: number }> }

/** Structural map presence alone must not certify an unrelated or invalid map. */
export async function assertStoredWordPageMaps(book: WordImportBook): Promise<void> {
  const [{ loadBookFromBuffer }, { requireWordPageGroups }] = await Promise.all([
    import('./engine/bridge'), import('./engine/dom_render'),
  ])
  const parts = book.volumes?.length ? [...book.volumes].sort((a, b) => a.number - b.number) : [book]
  for (const part of parts) {
    if (!part.wordPageMap) throw new Error('خريطة صفحات Word غير مكتملة')
    requireWordPageGroups(loadBookFromBuffer(part.data).model, part.wordPageMap)
  }
}

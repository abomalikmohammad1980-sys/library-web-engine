/** Consumer for source-verified V2 token boundaries; not a coverage declaration.
 * Caller must bind rows to the exact index release and verify their build receipts.
 * This module deliberately does not activate the unfinished corpus overlay.
 */
export type SearchFieldBoundaryRow = readonly [id: string, titleEnd: number, bodyEnd: number, documentEnd: number]
export type SeparatedContentScope = 'body' | 'foot'

export class SearchFieldBoundaries {
  private readonly rows = new Map<string, readonly [number, number, number]>()

  has(id: string): boolean { return this.rows.has(id) }

  tokenRange(id: string, scope: SeparatedContentScope): readonly [number, number, number] {
    if (scope !== 'body' && scope !== 'foot') throw Error('search_field_scope_invalid')
    const row = this.rows.get(id)
    if (!row) throw Error('search_field_boundary_missing')
    return [scope === 'body' ? row[0] : row[1], scope === 'body' ? row[1] : row[2], row[2]]
  }

  constructor(rows: readonly SearchFieldBoundaryRow[]) {
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== 4 || !/^\d+:\d+$/u.test(row[0]) || this.rows.has(row[0])) throw Error('search_field_boundary_identity')
      const ends = [row[1], row[2], row[3]] as const
      if (ends.some((value, index) => !Number.isSafeInteger(value) || value < 0 || (index > 0 && value < ends[index - 1]!))) throw Error('search_field_boundary_range')
      // Snapshot: later mutation of a caller-owned artifact cannot change a query.
      this.rows.set(row[0], ends)
    }
  }

  /** Exact occurrences, filtered BEFORE counting/sorting/pagination, never after. */
  phraseStarts(id: string, positionsByQueryWord: readonly (readonly number[])[], scope: SeparatedContentScope): number[] {
    if (scope !== 'body' && scope !== 'foot') throw Error('search_field_scope_invalid')
    const ends = this.rows.get(id)
    // An absent proof is not an empty field and must not yield a false negative.
    if (!ends) throw Error('search_field_boundary_missing')
    if (!positionsByQueryWord.length) return []
    const start = scope === 'body' ? ends[0] : ends[1], end = scope === 'body' ? ends[1] : ends[2]
    const sets = positionsByQueryWord.map(positions => {
      const set = new Set<number>()
      for (const position of positions) {
        if (!Number.isSafeInteger(position) || position < 0 || position >= ends[2] || set.has(position)) throw Error('search_field_posting_invalid')
        set.add(position)
      }
      return set
    })
    let anchor = 0
    for (let index = 1; index < sets.length; index++) if (sets[index]!.size < sets[anchor]!.size) anchor = index
    const found: number[] = []
    for (const position of sets[anchor]!) {
      const first = position - anchor
      if (first < start || first + sets.length > end) continue
      if (sets.every((set, index) => set.has(first + index))) found.push(first)
    }
    return found.sort((a, b) => a - b)
  }
}

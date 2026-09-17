import { normalizeArabicSearch, normalizeArabicSearchWithMap } from '../../packages/search/src/index'

/** Convert source-proved token ownership to a conservative lexical UTF-16
 * range in a checksum-verified raw V2 snippet. No separator/number heuristics.
 * Boundary punctuation may be omitted; text is never rewritten or reindexed.
 */
export function searchFieldTokenSourceRange(fullText: string, tokenRange: readonly [number, number, number]): readonly [number, number] {
  const [first, end, expectedTotal] = tokenRange
  if (![first, end, expectedTotal].every(Number.isSafeInteger) || first < 0 || first >= end || end > expectedTotal) throw Error('search_field_source_range')
  const normalized = normalizeArabicSearchWithMap(fullText), tokens = [...normalized.text.matchAll(/\S+/gu)]
  if (tokens.length !== expectedTotal) throw Error('search_field_source_token_count')
  const begin = normalized.originalOffsets[tokens[first]!.index]!, last = tokens[end - 1]!
  const lastOffset = normalized.originalOffsets[last.index + last[0].length - 1]!
  return [first === 0 ? 0 : begin, end === expectedTotal ? fullText.length : lastOffset + ((fullText.codePointAt(lastOffset) ?? 0) > 0xffff ? 2 : 1)]
}

/** Hydrate a proved occurrence against the same original source assembly used
 * by V2. Do not infer field ownership from separators or footnote-like digits.
 * The caller supplies a checksum-verified structural UTF-16 field range.
 */
export function searchFieldSourceSnippet(fullText: string, range: readonly [number, number], tokenStart: number, query: string) {
  const [start, end] = range
  if (![start, end, tokenStart].every(Number.isSafeInteger) || start < 0 || end < start || end > fullText.length || tokenStart < 0) throw Error('search_field_source_range')
  const normalized = normalizeArabicSearchWithMap(fullText), words = normalizeArabicSearch(query).split(' ').filter(Boolean)
  if (!words.length) throw Error('search_field_query_empty')
  const tokens = [...normalized.text.matchAll(/\S+/gu)], selected = tokens.slice(tokenStart, tokenStart + words.length)
  if (selected.length !== words.length || selected.some((token, index) => token[0] !== words[index])) throw Error('search_field_source_posting_mismatch')
  const first = selected[0]!, last = selected[selected.length - 1]!, lastIndex = last.index + last[0].length - 1
  const offsets = normalized.originalOffsets.slice(first.index, lastIndex + 1)
  if (!offsets.length || offsets.some(offset => offset < start || offset >= end)) throw Error('search_field_source_cross_boundary')
  const originalStart = offsets[0]!, originalLast = offsets[offsets.length - 1]!
  const originalEnd = originalLast + ((fullText.codePointAt(originalLast) ?? 0) > 0xffff ? 2 : 1)
  if (originalEnd > end) throw Error('search_field_source_cross_boundary')
  const text = fullText.slice(start, end), matchOffset = originalStart - start, matchEnd = originalEnd - start
  const snippetStart = Math.max(0, matchOffset - 90), snippetEnd = Math.min(text.length, matchEnd + 150)
  return { text, matchOffset, matchEnd, snippet: `${snippetStart ? '…' : ''}${text.slice(snippetStart, snippetEnd)}${snippetEnd < text.length ? '…' : ''}` }
}

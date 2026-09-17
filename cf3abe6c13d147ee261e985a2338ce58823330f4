import { describe, expect, it } from 'vitest'
import { normalizeArabic } from './search_presentation'
import { foldWithMap } from './screens/search'
import { hashWithQuery } from './hash_query_state'
import { filterAuthorEntries } from './author_filter'

describe('phase 7 Arabic RTL and Unicode search gate', () => {
  it.each([['الرَّحـمٰن','الرحمن'], ['ص\u200Dلاة','صلاه'], ['\u2067كتاب\u2069','كتاب'], ['١٢۳','123']])('normalizes %s only in the search copy', (source, expected) => { expect(normalizeArabic(source)).toBe(expected); expect(source).not.toBe(expected) })
  it('keeps folded highlight offsets aligned after combining marks and collapsed whitespace', () => { const source = '  إِنَّ   الكِتابَ ١٢۳ '; const folded = foldWithMap(source); expect(folded.value).toBe('ان الكتاب 123'); const start = folded.value.indexOf('كتاب'), original = source.slice(folded.map[start], (folded.map[start + 3] ?? 0) + 1); expect(normalizeArabic(original)).toBe('كتاب') })
  it('round-trips complex Arabic query text through the hash without losing controls intentionally present in URL state', () => { const query = 'إِنَّ الكتاب ١٢۳'; const hash = hashWithQuery('#/search?mode=root', { q: query }); expect(new URLSearchParams(hash.split('?')[1]).get('q')).toBe(query); expect(hash).toContain('mode=root') })
  it('treats the authors-directory box as a live partial filter', () => { const entries = [{ value: 'a', name: 'ابن علي', aliases: [], bookCount: 1 }, { value: 'b', name: 'ابن عُليان', aliases: [], bookCount: 1 }, { value: 'c', name: 'علي بن أحمد', aliases: [], bookCount: 1 }]; expect(filterAuthorEntries(entries, 'ابن علي', false).map(x => x.value)).toEqual(['a', 'b']) })
})

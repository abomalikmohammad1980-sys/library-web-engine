import { expect, it } from 'vitest'
import { searchFieldSourceSnippet } from './search_field_source_snippet'
it('uses the proved body occurrence even when a title contains the same phrase', () => {
  const title = 'باب العلم', body = 'هذا باب العلم في المتن', foot = 'باب العلم في الحاشية', full = `${title}\n\n${body}\n\n${foot}`
  const range = [title.length + 2, title.length + 2 + body.length] as const
  const found = searchFieldSourceSnippet(full, range, 3, 'باب العلم')
  expect(found.text).toBe(body); expect(found.matchOffset).toBe(4); expect(found.snippet).not.toContain('الحاشية')
  expect(() => searchFieldSourceSnippet(full, range, 0, 'باب العلم')).toThrow('search_field_source_cross_boundary')
})
it('keeps Arabic source diacritics and narrows the snippet to actual foot text', () => {
  const body = 'العلم نافع', foot = 'قال: العِلْمُ نور', full = `${body}\n\n${foot}`
  const found = searchFieldSourceSnippet(full, [body.length + 2, full.length], 3, 'العلم')
  expect(found.text).toBe(foot); expect(found.snippet).toContain('العِلْمُ'); expect(found.snippet).not.toContain('نافع')
})
it('rejects stale postings and phrases that span separate fields', () => {
  const full = 'عالم الغيب\n\nوالشهادة'
  expect(() => searchFieldSourceSnippet(full, [0, 10], 1, 'الغيب والشهادة')).toThrow('search_field_source_cross_boundary')
  expect(() => searchFieldSourceSnippet(full, [0, full.length], 0, 'شيء آخر')).toThrow('search_field_source_posting_mismatch')
})

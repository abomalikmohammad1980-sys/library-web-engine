import { afterEach, expect, it, vi } from 'vitest'
import { hasSearchFieldRelease, searchFieldReleaseBinding } from './search_field_release'
const valid = () => ({ complete: true, manifestUrl: 'https://fields.test/manifest.json', manifestSha256: 'a'.repeat(64), sourceIndexSha256: 'b'.repeat(64), packedManifestSha256: 'c'.repeat(64), packedReleaseId: 'verified-release', expectedBooks: 8594, expectedSegments: 860 })
afterEach(() => vi.unstubAllGlobals())
it('defaults to disabled and rejects incomplete or unpinned opt-ins', () => {
  expect(searchFieldReleaseBinding()).toBeUndefined()
  for (const value of [{ ...valid(), complete: false }, { ...valid(), manifestSha256: '' }, { ...valid(), expectedBooks: 0 }, { ...valid(), manifestUrl: 'https://user:secret@fields.test/' }]) {
    vi.stubGlobal('__KHIZANA_SEARCH_FIELDS__', value)
    expect(hasSearchFieldRelease()).toBe(false)
    expect(() => searchFieldReleaseBinding()).toThrow()
  }
})
it('snapshots an explicitly pinned complete release without activating anything', () => {
  const input = valid(); vi.stubGlobal('__KHIZANA_SEARCH_FIELDS__', input)
  const binding = searchFieldReleaseBinding()!
  input.manifestSha256 = 'd'.repeat(64)
  expect(binding.manifestSha256).toBe('a'.repeat(64)); expect(Object.isFrozen(binding)).toBe(true)
})

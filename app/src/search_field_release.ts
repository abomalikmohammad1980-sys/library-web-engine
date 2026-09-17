import type { SeparatedV2SearchBinding } from './shamela_search_v2'

/** Deployment opt-in only. No guessed path, localStorage flag, or partial fallback. */
export function searchFieldReleaseBinding(): Readonly<SeparatedV2SearchBinding> | undefined {
  const value = (globalThis as typeof globalThis & { __KHIZANA_SEARCH_FIELDS__?: unknown }).__KHIZANA_SEARCH_FIELDS__
  if (value === undefined) return undefined
  const v = value as SeparatedV2SearchBinding & { complete?: boolean }
  const sha = /^[a-f0-9]{64}$/u
  if (!v || v.complete !== true || !sha.test(v.manifestSha256) || !sha.test(v.sourceIndexSha256) || !sha.test(v.packedManifestSha256) || !v.packedReleaseId || !Number.isSafeInteger(v.expectedBooks) || v.expectedBooks < 1 || !Number.isSafeInteger(v.expectedSegments) || v.expectedSegments < 1) throw Error('search_field_release_config')
  const url = new URL(v.manifestUrl)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.search) throw Error('search_field_release_config')
  return Object.freeze({ manifestUrl: url.href, manifestSha256: v.manifestSha256, sourceIndexSha256: v.sourceIndexSha256, packedManifestSha256: v.packedManifestSha256, packedReleaseId: v.packedReleaseId, expectedBooks: v.expectedBooks, expectedSegments: v.expectedSegments })
}

export function hasSearchFieldRelease(): boolean {
  try { return !!searchFieldReleaseBinding() } catch { return false }
}

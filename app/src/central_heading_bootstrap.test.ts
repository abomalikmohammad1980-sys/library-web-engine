import { describe, expect, it } from 'vitest'
import headingReleaseText from './heading_release.generated.json?raw'
import { validateCentralHeadingRelease } from './central_heading_bootstrap'

describe('bundled heading release descriptor', () => {
  it('matches the pinned integrity hash and full-library contract', async () => {
    const release = await validateCentralHeadingRelease(new TextEncoder().encode(headingReleaseText.trimEnd()))
    expect(release.coveredSourceBookIds).toHaveLength(8553)
    expect(release.baseURL).toBe(`/api/search/headings/${release.releaseId}/`)
  })
})

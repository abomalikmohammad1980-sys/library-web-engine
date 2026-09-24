import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const helper = readFileSync(new URL('./artifact_download.ts', import.meta.url), 'utf8')
const settings = readFileSync(new URL('./screens/settings.ts', import.meta.url), 'utf8')

describe('downloadable artifact contract', () => {
  it('mounts the named link before clicking and always removes and revokes it', () => {
    expect(helper).toContain('document.body.appendChild(link)')
    expect(helper.indexOf('document.body.appendChild(link)')).toBeLessThan(helper.indexOf('link.click()'))
    expect(helper).toContain('link.remove()')
    expect(helper).toContain('revokeTrackedObjectURL(url)')
    expect(helper).toContain('DOWNLOAD_URL_GRACE_MS = 30_000')
    expect(helper).not.toContain('revokeTrackedObjectURL(url), 0')
  })

  it('routes the reading-data export through the shared artifact downloader', () => {
    expect(settings).toContain('downloadArtifact({')
    expect(settings).not.toContain("const link = document.createElement('a')")
  })
})

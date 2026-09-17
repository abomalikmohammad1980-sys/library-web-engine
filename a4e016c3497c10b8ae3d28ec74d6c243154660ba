import { describe, expect, it } from 'vitest'
import { HADEETHENC_AR_SOURCE, sourcePageHref, validateSunnahProvenance, validateSunnahSource, type SunnahSourceRecord } from './sunnah_source_registry'

const checksum = 'a'.repeat(64)
const source: SunnahSourceRecord = {
  id: 'verified-corpus', name: 'مصدر موثق', homepage: 'https://example.org/source',
  attributionLabel: 'بيانات المصدر', kind: 'hadith-corpus', storagePolicy: 'synchronized',
  release: { version: '2026-08-10', retrievedAt: '2026-08-10T00:00:00Z', checksumSha256: checksum, manifestPath: '/sunnah/verified/manifest.json' },
}

describe('sunnah source registry contract', () => {
  it('accepts a versioned HTTPS source with a pinned manifest checksum', () => {
    expect(validateSunnahSource(source)).toEqual([])
  })

  it('fails closed for a synchronized source without a release or with traversal', () => {
    expect(validateSunnahSource({ ...source, release: undefined })).toContain('المصدر المحلي أو المتزامن يحتاج إصدارًا وبصمة manifest')
    expect(validateSunnahSource({ ...source, release: { ...source.release!, manifestPath: '/../secret' } }))
      .toContain('مسار manifest المصدر غير صالح')
  })

  it('requires every witness to match a registered release and record checksum', () => {
    expect(validateSunnahProvenance({ sourceId: source.id, releaseVersion: source.release!.version, recordLocator: 'book/1/hadith/2', recordChecksumSha256: checksum }, [source])).toEqual([])
    expect(validateSunnahProvenance({ sourceId: source.id, releaseVersion: 'old', recordLocator: '', recordChecksumSha256: 'bad' }, [source]))
      .toEqual(['إصدار الشاهد لا يطابق إصدار المصدر', 'موضع الشاهد داخل المصدر مطلوب', 'بصمة سجل الشاهد غير صالحة'])
  })

  it('routes attribution to one dedicated source page', () => {
    expect(sourcePageHref('verified-corpus')).toBe('#/sunnah/source/verified-corpus')
    expect(validateSunnahSource(HADEETHENC_AR_SOURCE)).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { mayBundleSunnahSource, validateHadithUnit, type HadithUnit, type SunnahProvenance } from './sunnah_domain'

const provenance = (access: SunnahProvenance['access'] = 'bundled'): SunnahProvenance => ({
  provider: 'المصدر', sourceUrl: 'https://example.test/source', version: '1',
  licenseOrTermsUrl: 'https://example.test/terms', access,
})

const unit = (): HadithUnit => ({
  hadithId: 'h-1', canonicalText: 'إنما الأعمال بالنيات',
  witnesses: [{ witnessId: 'w-1', hadithId: 'h-1', text: 'إنما الأعمال بالنيات', source: { bookId: 'bukhari', title: 'صحيح البخاري', hadithNumber: '1', readerAnchor: 'hadith-1' }, provenance: provenance(), narrators: [{ narratorId: 'n-1', displayName: 'عمر بن الخطاب', position: 0 }] }],
  verdicts: [{ verdictId: 'v-1', hadithId: 'h-1', scholarId: 's-1', scholarName: 'الإمام البخاري', wording: 'أورده في الصحيح', source: { bookId: 'bukhari', title: 'صحيح البخاري', hadithNumber: '1' }, provenance: provenance() }],
  explanations: [], translations: [],
})

describe('Sunnah local domain', () => {
  it('requires every scientific statement to retain source, edition position and terms', () => {
    expect(validateHadithUnit(unit())).toEqual([])
    const broken = unit(); broken.verdicts[0]!.provenance.licenseOrTermsUrl = ''
    expect(validateHadithUnit(broken)).toContain('verdict-attribution-invalid:v-1')
  })

  it('never collapses different scholars into an unattributed grade', () => {
    const broken = unit(); broken.verdicts[0]!.scholarName = ''; broken.verdicts[0]!.wording = ''
    expect(validateHadithUnit(broken)).toContain('verdict-attribution-invalid:v-1')
  })

  it('synchronizes waqf APIs into the offline bundle unless the provider explicitly blocks it', () => {
    expect(mayBundleSunnahSource(provenance('bundled'))).toBe(true)
    expect(mayBundleSunnahSource(provenance('downloadable-with-terms'))).toBe(true)
    expect(mayBundleSunnahSource(provenance('api-synchronizable'))).toBe(true)
    expect(mayBundleSunnahSource(provenance('explicitly-blocked'))).toBe(false)
  })
})

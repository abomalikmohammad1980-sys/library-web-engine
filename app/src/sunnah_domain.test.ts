import { describe, expect, it } from 'vitest'
import { mayBundleSunnahSource, validateHadithUnit, type HadithUnit, type SunnahProvenance } from './sunnah_domain'

const provenance = (access: SunnahProvenance['access'] = 'bundled'): SunnahProvenance => ({
  provider: 'المصدر', sourceUrl: 'https://example.test/source', version: '1',
  licenseOrTermsUrl: 'https://example.test/terms', access, checksumSha256: 'a'.repeat(64),
})

const unit = (): HadithUnit => ({
  hadithId: 'h-1', canonicalText: 'إنما الأعمال بالنيات',
  witnesses: [{ witnessId: 'w-1', hadithId: 'h-1', text: 'إنما الأعمال بالنيات', source: { bookId: 'bukhari', title: 'صحيح البخاري', volume: '1', page: '6', hadithNumber: '1', readerAnchor: 'hadith-1' }, provenance: provenance(), narrators: [{ narratorId: 'n-1', displayName: 'عمر بن الخطاب', position: 0 }] }],
  verdicts: [{ verdictId: 'v-1', hadithId: 'h-1', scholarId: 's-1', scholarName: 'الإمام البخاري', wording: 'أورده في الصحيح', source: { bookId: 'bukhari', title: 'صحيح البخاري', volume: '1', page: '6', hadithNumber: '1' }, provenance: provenance() }],
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

  it('rejects a witness or verdict whose exact edition position is incomplete', () => {
    const missingWitnessPage = unit(); missingWitnessPage.witnesses[0]!.source.page = ''
    expect(validateHadithUnit(missingWitnessPage)).toContain('witness-source-invalid:w-1')
    const missingVerdictVolume = unit(); missingVerdictVolume.verdicts[0]!.source.volume = ''
    expect(validateHadithUnit(missingVerdictVolume)).toContain('verdict-attribution-invalid:v-1')
  })

  it('rejects scientific attribution without a verifiable source fingerprint', () => {
    const broken = unit(); broken.witnesses[0]!.provenance.checksumSha256 = undefined
    expect(validateHadithUnit(broken)).toContain('witness-source-invalid:w-1')
  })

  it('holds commentary and gharib to the same exact-source contract', () => {
    const broken = unit()
    broken.explanations.push({
      explanationId: 'e-1', hadithId: 'h-1', kind: 'gharib', text: 'شرح اللفظة',
      source: { bookId: 'commentary', title: 'شرح الحديث', volume: '1', page: '', hadithNumber: '1' },
      provenance: provenance(),
    })
    expect(validateHadithUnit(broken)).toContain('derived-source-invalid:e-1')
  })

  it('rejects a translation detached from the canonical hadith or its fingerprint', () => {
    const broken = unit()
    broken.translations.push({ translationId: 't-1', hadithId: 'other', language: 'en', text: 'Actions are by intentions.', provenance: provenance() })
    expect(validateHadithUnit(broken)).toContain('derived-source-invalid:t-1')
  })

  it('synchronizes waqf APIs into the offline bundle unless the provider explicitly blocks it', () => {
    expect(mayBundleSunnahSource(provenance('bundled'))).toBe(true)
    expect(mayBundleSunnahSource(provenance('downloadable-with-terms'))).toBe(true)
    expect(mayBundleSunnahSource(provenance('api-synchronizable'))).toBe(true)
    expect(mayBundleSunnahSource(provenance('explicitly-blocked'))).toBe(false)
  })
})

export type SunnahSourceAccess = 'bundled' | 'downloadable-with-terms' | 'api-synchronizable' | 'explicitly-blocked'

export interface SunnahProvenance {
  provider: string
  sourceUrl: string
  version: string
  licenseOrTermsUrl: string
  access: SunnahSourceAccess
  checksumSha256?: string
  retrievedAt?: string
}

export interface HadithBookRef {
  bookId: string
  title: string
  editionId?: string
  volume?: string
  page?: string
  bookNumber?: string
  chapterNumber?: string
  hadithNumber?: string
  readerAnchor?: string
}

export interface NarratorRef {
  narratorId: string
  displayName: string
  position: number
  transmissionForm?: string
}

export interface HadithWitness {
  witnessId: string
  hadithId: string
  text: string
  isnadText?: string
  narrators?: NarratorRef[]
  source: HadithBookRef
  provenance: SunnahProvenance
}

export interface ScholarVerdict {
  verdictId: string
  hadithId: string
  scholarId: string
  scholarName: string
  wording: string
  grade?: string
  source: HadithBookRef
  provenance: SunnahProvenance
}

export interface HadithExplanation {
  explanationId: string
  hadithId: string
  kind: 'commentary' | 'gharib' | 'benefit'
  text: string
  source: HadithBookRef
  provenance: SunnahProvenance
}

export interface HadithTranslation {
  translationId: string
  hadithId: string
  language: string
  text: string
  explanation?: string
  provenance: SunnahProvenance
}

export interface HadithUnit {
  hadithId: string
  canonicalText: string
  companionNarrator?: string
  topics?: string[]
  witnesses: HadithWitness[]
  verdicts: ScholarVerdict[]
  explanations: HadithExplanation[]
  translations: HadithTranslation[]
}

const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

export function validSunnahProvenance(value: SunnahProvenance): boolean {
  return hasText(value.provider) && hasText(value.sourceUrl) && hasText(value.version)
    && hasText(value.licenseOrTermsUrl) && hasText(value.access)
    && hasText(value.checksumSha256) && /^[a-f\d]{64}$/i.test(value.checksumSha256)
}

export function validHadithBookRef(value: HadithBookRef): boolean {
  return hasText(value.bookId) && hasText(value.title) && hasText(value.volume)
    && hasText(value.page) && hasText(value.hadithNumber)
}

export function validateHadithUnit(value: HadithUnit): string[] {
  const errors: string[] = []
  if (!hasText(value.hadithId)) errors.push('hadith-id-required')
  if (!hasText(value.canonicalText)) errors.push('canonical-text-required')
  if (!value.witnesses.length) errors.push('witness-required')
  for (const witness of value.witnesses) {
    if (witness.hadithId !== value.hadithId) errors.push(`witness-hadith-mismatch:${witness.witnessId}`)
    if (!hasText(witness.text) || !validHadithBookRef(witness.source) || !validSunnahProvenance(witness.provenance)) errors.push(`witness-source-invalid:${witness.witnessId}`)
    const positions = witness.narrators?.map(item => item.position) ?? []
    if (new Set(positions).size !== positions.length || positions.some(position => !Number.isInteger(position) || position < 0)) errors.push(`isnad-order-invalid:${witness.witnessId}`)
  }
  for (const verdict of value.verdicts) {
    if (verdict.hadithId !== value.hadithId || !hasText(verdict.scholarName) || !hasText(verdict.wording) || !validHadithBookRef(verdict.source) || !validSunnahProvenance(verdict.provenance)) errors.push(`verdict-attribution-invalid:${verdict.verdictId}`)
  }
  for (const explanation of value.explanations) {
    if (explanation.hadithId !== value.hadithId || !hasText(explanation.text)
      || !validHadithBookRef(explanation.source) || !validSunnahProvenance(explanation.provenance)) {
      errors.push(`derived-source-invalid:${explanation.explanationId}`)
    }
  }
  for (const translation of value.translations) {
    if (translation.hadithId !== value.hadithId || !hasText(translation.language)
      || !hasText(translation.text) || !validSunnahProvenance(translation.provenance)) {
      errors.push(`derived-source-invalid:${translation.translationId}`)
    }
  }
  return errors
}

export function mayBundleSunnahSource(source: SunnahProvenance): boolean {
  return source.access !== 'explicitly-blocked'
}

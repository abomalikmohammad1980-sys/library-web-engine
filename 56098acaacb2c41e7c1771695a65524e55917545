import { describe, expect, it, vi } from 'vitest'
import { requestEstimatedImportOverride, WORD_MAP_BLOCKING_MESSAGE, wordImportAuthorityMode } from './word_import_authority'

describe('authoritative Word import gate', () => {
  const bytes = new TextEncoder().encode('docx-fixture')
  it('writes nothing when the default or second confirmation is cancelled', async () => {
    const first = vi.fn(() => false); expect(await requestEstimatedImportOverride(bytes, first)).toBeNull(); expect(first).toHaveBeenCalledWith(expect.stringContaining(WORD_MAP_BLOCKING_MESSAGE))
    const second = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false); expect(await requestEstimatedImportOverride(bytes, second)).toBeNull(); expect(second).toHaveBeenCalledTimes(2)
  })
  it('records a deterministic fingerprint and explicit double consent without claiming authority', async () => {
    const confirm = vi.fn(() => true), result = await requestEstimatedImportOverride(bytes, confirm, () => 123)
    expect(confirm).toHaveBeenCalledTimes(2); expect(result).toMatchObject({ paginationAuthority: 'user-approved-estimate', paginationOverride: { consentAt: 123 } })
    expect(result?.paginationOverride.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(result?.paginationOverride.operationId).toContain(result!.paginationOverride.sourceFingerprint.slice(0, 16))
  })
  it('invalidates consent identity when source bytes change', async () => {
    const yes = () => true, a = await requestEstimatedImportOverride(bytes, yes), b = await requestEstimatedImportOverride(new TextEncoder().encode('changed'), yes)
    expect(a?.paginationOverride.sourceFingerprint).not.toBe(b?.paginationOverride.sourceFingerprint)
  })
  it('uses Microsoft Word conversion by default and reserves estimates for unavailable/manual paths', () => {
    expect(wordImportAuthorityMode({ hasWord: false, manualPdf: false, wordConversionAvailable: true })).toBe('not-word')
    expect(wordImportAuthorityMode({ hasWord: true, manualPdf: false, wordConversionAvailable: true })).toBe('authoritative-conversion')
    expect(wordImportAuthorityMode({ hasWord: true, manualPdf: false, wordConversionAvailable: false })).toBe('estimated-consent')
    expect(wordImportAuthorityMode({ hasWord: true, manualPdf: true, wordConversionAvailable: true })).toBe('estimated-consent')
  })
})

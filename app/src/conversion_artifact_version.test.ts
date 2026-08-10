import { describe, expect, it, vi } from 'vitest'
import { CURRENT_CONVERSION_ARTIFACT_VERSION, ensureCurrentBookArtifacts, startBookArtifactRefresh, type VersionedBookArtifact } from './conversion_artifact_version'

function adapter(record: VersionedBookArtifact, fail = false) {
  return {
    markAttempt: vi.fn(async (_id: string, version: string, at: number) => { record.conversionArtifactAttemptVersion = version; record.conversionArtifactAttemptedAt = at }),
    rebuild: vi.fn(async () => { if (fail) throw new Error('converter failed'); return record }),
    markCurrent: vi.fn(async (_id: string, version: string) => { record.conversionArtifactVersion = version; delete record.conversionArtifactFailedAt; return { ...record } }),
    markFailure: vi.fn(async (_id: string, version: string, at: number) => { record.conversionArtifactAttemptVersion = version; record.conversionArtifactFailedAt = at }),
  }
}

describe('conversion artifact version gate', () => {
  it('rebuilds a legacy record once and skips the second open', async () => {
    const record: VersionedBookArtifact = { id: 'legacy', conversionArtifactVersion: 'word-pagination-2026-08-08-v4' }
    const bridge = adapter(record)
    const rebuilt = await ensureCurrentBookArtifacts(record, bridge, 100)
    expect(rebuilt.conversionArtifactVersion).toBe(CURRENT_CONVERSION_ARTIFACT_VERSION)
    await ensureCurrentBookArtifacts(rebuilt, bridge, 200)
    expect(bridge.rebuild).toHaveBeenCalledTimes(1)
  })

  it('returns the old artifact immediately while one slow refresh swaps storage in the background', async () => {
    const record: VersionedBookArtifact = { id: 'slow-legacy' }
    let finish!: () => void
    const slow = new Promise<void>(resolve => { finish = resolve })
    const bridge = adapter(record)
    bridge.rebuild.mockImplementation(async () => { await slow; return record })

    const first = startBookArtifactRefresh(record, bridge, 100)
    expect(first.started).toBe(true)
    expect(record.conversionArtifactVersion).toBeUndefined()
    await Promise.resolve()
    const parallel = startBookArtifactRefresh(record, bridge, 101)
    expect(parallel.started).toBe(false)
    expect(bridge.rebuild).toHaveBeenCalledTimes(1)

    finish()
    const updated = await first.completion
    expect(updated.conversionArtifactVersion).toBe(CURRENT_CONVERSION_ARTIFACT_VERSION)
    expect(startBookArtifactRefresh(updated, bridge, 200).started).toBe(false)
    expect(bridge.rebuild).toHaveBeenCalledTimes(1)
  })

  it('keeps old artifacts on failure and suppresses an immediate rebuild loop', async () => {
    const record: VersionedBookArtifact = { id: 'legacy' }
    const bridge = adapter(record, true)
    const old = await ensureCurrentBookArtifacts(record, bridge, 100)
    expect(old.conversionArtifactVersion).toBeUndefined()
    await ensureCurrentBookArtifacts(record, bridge, 200)
    expect(bridge.rebuild).toHaveBeenCalledTimes(1)
    expect(record.conversionArtifactFailedAt).toBe(100)
  })
})

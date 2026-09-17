import { describe, expect, it, vi } from 'vitest'
import { connectAppSourceSync, localSourceSyncState, presentSourceSync } from './source_sync_ui'

describe('app source-sync gateway', () => {
  it('is honestly local-only when no provider is configured', async () => {
    const emit = vi.fn()
    expect(await connectAppSourceSync(undefined, emit)).toMatchObject({ phase: 'localOnly', uploadAllowed: false })
    expect(emit).toHaveBeenCalledOnce()
  })

  it('never contacts or enables upload for signed-out and guest identities', async () => {
    const token = vi.fn(async () => 'must-not-be-read')
    for (const kind of ['signedOut', 'guest'] as const) {
      const state = await connectAppSourceSync({ identity: () => ({ kind }), baseUrl: 'https://sync.example/', bookId: 'b', deviceId: 'd', token }, () => {})
      expect(state).toMatchObject({ phase: kind, uploadAllowed: false })
    }
    expect(token).not.toHaveBeenCalled()
  })

  it('requires the complete feature-gated provider contract before connecting', async () => {
    const state = await connectAppSourceSync({ identity: () => ({ kind: 'authenticated', userId: 'u' }) }, () => {})
    expect(state.phase).toBe('localOnly')
    expect(presentSourceSync(state).canRefresh).toBe(false)
  })

  it('presents operational counts and stale offline state without claiming a fresh sync', () => {
    expect(presentSourceSync({ ...localSourceSyncState('localOnly'), phase: 'conflict', conflictCount: 2 }).detail).toContain('2')
    expect(presentSourceSync({ ...localSourceSyncState('localOnly'), phase: 'offline', stale: true }).title).toContain('دون اتصال')
  })
})

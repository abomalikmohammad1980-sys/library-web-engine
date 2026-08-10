import { describe, expect, it } from 'vitest'
import { capabilitySummary, offlineCapabilities } from './offline_policy'

describe('offline capability policy', () => {
  it('keeps reading, search, and personal data available offline', () => {
    const items = offlineCapabilities(false)
    expect(items.filter(item => item.availability === 'available').map(item => item.id)).toEqual(['reading', 'search', 'library-data'])
    expect(items.find(item => item.id === 'word-conversion')?.detail).toContain('مؤجل')
  })

  it('recognizes local desktop conversion without claiming account sync', () => {
    const items = offlineCapabilities(false, true)
    expect(items.find(item => item.id === 'word-conversion')?.availability).toBe('device-only')
    expect(items.find(item => item.id === 'account-sync')?.availability).toBe('connection-required')
    expect(capabilitySummary(items)).toEqual({ available: 4, unavailable: 1 })
  })
})

import { describe, expect, it } from 'vitest'
import { guestSessionIdentity, identityLabel, identityScope } from './session_identity'

class MemorySessionStorage {
  private values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}

describe('session identity', () => {
  it('يحفظ هوية الضيف طوال الجلسة نفسها فقط', () => {
    const session = new MemorySessionStorage()
    const first = guestSessionIdentity(session, () => 'guest_first')
    const again = guestSessionIdentity(session, () => 'guest_other')
    expect(first).toEqual({ kind: 'guest', sessionId: 'guest_first' })
    expect(again).toEqual(first)
    expect(guestSessionIdentity(new MemorySessionStorage(), () => 'guest_new'))
      .toEqual({ kind: 'guest', sessionId: 'guest_new' })
  })

  it('يفصل نطاق الضيف عن المستخدم المسجل', () => {
    expect(identityScope({ kind: 'guest', sessionId: 'g1' })).toBe('guest:g1')
    expect(identityScope({ kind: 'authenticated', userId: 'u1' })).toBe('user:u1')
    expect(identityLabel({ kind: 'guest', sessionId: 'g1' })).toBe('ضيف')
    expect(identityLabel({ kind: 'authenticated', userId: 'u1', displayName: 'أحمد' })).toBe('أحمد')
  })
})

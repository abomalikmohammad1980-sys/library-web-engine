import { installTrustedRuntimeClaims, type AccountClaims, type AuthProvider } from './account_authority'

/** للاختبارات فقط؛ لا تستورده شيفرة الإنتاج. */
export function trustedTestAuthProvider(claims: AccountClaims): AuthProvider {
  return {
    state: 'ready',
    async currentSession() { return { ...claims } },
    async signIn() { installTrustedRuntimeClaims(claims); return { kind: 'authenticated', claims: { ...claims } } },
    async signOut() { installTrustedRuntimeClaims(null) },
  }
}

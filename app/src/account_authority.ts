/**
 * عقد صلاحيات الحساب في واجهة الخِزانة.
 *
 * مهم: هذه الطبقة تمنع الواجهة من إظهار/تنفيذ عمليات إدارية بهوية عادية،
 * لكنها ليست حدًا أمنيًا خادميًا. لا تُقبل الرتبة من localStorage أو من حقول
 * نموذج؛ مزود الهوية الموثوق (حين يُربط بالخادم) هو وحده من يثبت claims.
 */
export type AccountRole = 'user' | 'admin' | 'editor' | 'super-admin'

export type AccountPermission =
  | 'book:review-submissions'
  | 'book:create-published'
  | 'book:edit-published-metadata'
  | 'book:edit-published-author'
  | 'book:edit-published-category'
  | 'book:edit-published-visibility'
  | 'book:logical-delete-published'

export interface AccountClaims {
  subject: string
  role: AccountRole
  displayName?: string
  /** معرّف جلسة يصدره مزود الهوية؛ ليس كلمة مرور ولا رمز وصول. */
  sessionId: string
}

export type AuthServiceState = 'ready' | 'not-configured'
export type SignInResult = { kind: 'authenticated'; claims: AccountClaims } | { kind: 'not-configured' }

/** عقد مزود الهوية؛ تنفيذ الخادم لاحقًا مسؤول عن التحقق من الجلسة والرتبة. */
export interface AuthProvider {
  readonly state: AuthServiceState
  currentSession(): Promise<AccountClaims | null>
  signIn(): Promise<SignInResult>
  signOut(): Promise<void>
}

export const unconfiguredAuthProvider: AuthProvider = {
  state: 'not-configured',
  async currentSession() { return null },
  async signIn() { return { kind: 'not-configured' } },
  async signOut() { installTrustedRuntimeClaims(null) },
}

const ROLE_PERMISSIONS: Readonly<Record<AccountRole, ReadonlySet<AccountPermission>>> = {
  user: new Set(),
  admin: new Set(['book:review-submissions', 'book:create-published']),
  editor: new Set(['book:create-published','book:edit-published-metadata','book:edit-published-author','book:edit-published-category']),
  'super-admin': new Set([
    'book:review-submissions',
    'book:create-published',
    'book:edit-published-metadata',
    'book:edit-published-author',
    'book:edit-published-category',
    'book:edit-published-visibility',
    'book:logical-delete-published',
  ]),
}

export function hasAccountPermission(claims: AccountClaims | null, permission: AccountPermission): boolean {
  return Boolean(claims && ROLE_PERMISSIONS[claims.role].has(permission))
}

export function requireAccountPermission(claims: AccountClaims | null, permission: AccountPermission): void {
  if (!hasAccountPermission(claims, permission)) throw new Error('ليس لديك إذن لتنفيذ هذا الإجراء')
}

/** لا توجد جلسة إدارية محلية افتراضيًا. يركّب adapter تسجيل الدخول هذه الدالة
 * بعد تحقق الخادم من الجلسة؛ إبقاؤها في الذاكرة يمنع ترقية الدور عبر التخزين المحلي. */
let trustedRuntimeClaims: AccountClaims | null = null
let authorityRevision = 0
/** Invalidates pending session reads even when a repeated rejection keeps claims null. */
export function currentAccountAuthorityRevision(): number { return authorityRevision }

/** حد وقت التشغيل لكل adapter هوية؛ الأنواع وحدها لا تحمي من رد شبكي مشوّه. */
export function isTrustedAccountClaims(value: unknown): value is AccountClaims {
  if (!value || typeof value !== 'object') return false
  const claims = value as Partial<AccountClaims>
  return typeof claims.subject === 'string' && claims.subject.trim().length > 0 && claims.subject.length <= 240
    && (claims.role === 'user' || claims.role === 'admin' || claims.role === 'editor' || claims.role === 'super-admin')
    && typeof claims.sessionId === 'string' && claims.sessionId.trim().length > 0 && claims.sessionId.length <= 512
    && (claims.displayName === undefined || (typeof claims.displayName === 'string' && claims.displayName.length <= 200))
}

export function installTrustedRuntimeClaims(claims: AccountClaims | null): void {
  authorityRevision++
  // يفشل مغلقًا ويمحو أي صلاحية سابقة عند وصول قيمة غير صالحة من adapter.
  const next = claims && isTrustedAccountClaims(claims) ? Object.freeze({ ...claims }) : null
  const previous = trustedRuntimeClaims
  trustedRuntimeClaims = next
  // Session probes must not remount the route when identity is unchanged:
  // remounting the login screen starts another probe and otherwise loops.
  if (previous === next || (previous && next && previous.subject === next.subject
    && previous.sessionId === next.sessionId && previous.role === next.role
    && previous.displayName === next.displayName)) return
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('alkhizana:account-changed'))
}

export function currentAccountClaims(): AccountClaims | null {
  return trustedRuntimeClaims ? { ...trustedRuntimeClaims } : null
}

/** تسمية عرض آمنة للحساب؛ لا تكشف subject أو sessionId في الواجهة. */
export function accountClaimsLabel(claims: AccountClaims): string {
  return claims.displayName?.trim() || (claims.role === 'super-admin' ? 'المدير العام' : claims.role === 'admin' ? 'مدير مراجعة' : claims.role === 'editor' ? 'محرر الكتب والتراجم' : 'حساب مسجل')
}

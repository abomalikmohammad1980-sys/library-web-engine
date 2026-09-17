/** عقد الهوية المشترك لكل واجهات الخزانة.
 *
 * لا يختار مزود تسجيل الدخول ولا يثق ببيانات العميل للحماية؛ الهوية المسجلة
 * سيحسمها الخادم لاحقًا. أما الضيف فيملك معرفًا عشوائيًا يعيش في sessionStorage
 * فقط، فيثبت طوال التبويب/الجلسة ولا يتحول إلى حساب دائم من تلقاء نفسه.
 */

export type SessionIdentity =
  | { kind: 'guest'; sessionId: string }
  | { kind: 'authenticated'; userId: string; email?: string; displayName?: string }

export interface IdentityProvider {
  current(): Promise<SessionIdentity>
}

const GUEST_SESSION_KEY = 'alkhizana:guest-session-id'
let memoryGuestId: string | null = null

function randomSessionId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `guest_${uuid}`
  const bytes = new Uint32Array(4)
  globalThis.crypto?.getRandomValues?.(bytes)
  const entropy = Array.from(bytes, value => value.toString(36)).join('')
  return `guest_${Date.now().toString(36)}_${entropy || Math.random().toString(36).slice(2)}`
}

/** يعيد ضيف الجلسة الحالي. حقن Storage يجعل العقد قابلًا للاختبار والعمل في SSR. */
export function guestSessionIdentity(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeSessionStorage(),
  createId: () => string = randomSessionId,
): SessionIdentity {
  let stored:string|null|undefined
  try{stored=storage?.getItem(GUEST_SESSION_KEY)}catch{storage=null}
  if (stored) return { kind: 'guest', sessionId: stored }
  if (!storage && memoryGuestId) return { kind: 'guest', sessionId: memoryGuestId }
  const sessionId = memoryGuestId ?? createId()
  if (storage) {try{storage.setItem(GUEST_SESSION_KEY, sessionId)}catch{memoryGuestId=sessionId}}
  else memoryGuestId = sessionId
  return { kind: 'guest', sessionId }
}
function safeSessionStorage():Storage|null{try{return typeof sessionStorage==='undefined'?null:sessionStorage}catch{return null}}

/** مفتاح نطاقٍ للبيانات المؤقتة في العميل؛ ليس تفويضًا ولا بديلًا لفحص الخادم. */
export function identityScope(identity: SessionIdentity): string {
  return identity.kind === 'authenticated' ? `user:${identity.userId}` : `guest:${identity.sessionId}`
}

export function identityLabel(identity: SessionIdentity): string {
  if (identity.kind === 'guest') return 'ضيف'
  return identity.displayName?.trim() || identity.email?.trim() || 'حسابي'
}

export const guestIdentityProvider: IdentityProvider = {
  async current() { return guestSessionIdentity() },
}

import { SourceSyncHttpClient, SourceSyncSession, type SourceSyncIdentity, type SourceSyncViewState } from '@library/source-sync'

export interface AppSourceSyncGateway {
  baseUrl?: string
  bookId?: string
  deviceId?: string
  identity: () => SourceSyncIdentity | Promise<SourceSyncIdentity>
  token?: () => Promise<string | null>
  requestSignIn?: () => void
}

declare global { interface Window { __KHIZANA_SOURCE_SYNC__?: AppSourceSyncGateway } }

export interface SourceSyncPresentation { title: string; detail: string; tone: 'neutral' | 'progress' | 'success' | 'warning' | 'danger'; canRefresh: boolean; canSignIn: boolean }

export function presentSourceSync(state: SourceSyncViewState, gateway?: AppSourceSyncGateway): SourceSyncPresentation {
  const counts = state.quarantineCount ? `${state.quarantineCount} ملف قيد العزل` : state.conflictCount ? `${state.conflictCount} تعارض` : state.pendingCount ? `${state.pendingCount} عملية معلقة` : ''
  const map: Record<SourceSyncViewState['phase'], Omit<SourceSyncPresentation, 'canRefresh' | 'canSignIn'>> = {
    signedOut: { title: 'غير مسجّل الدخول', detail: 'كتبك وبيانات قراءتك باقية على هذا الجهاز، ولا يُرفع أي ملف.', tone: 'neutral' },
    guest: { title: 'وضع الضيف', detail: 'الرفع ممنوع في وضع الضيف؛ يمكنك متابعة العمل محليًا بأمان.', tone: 'neutral' },
    localOnly: { title: 'محلي فقط', detail: 'لا توجد بوابة مزامنة مفعلة. تظل جميع الملفات على هذا الجهاز.', tone: 'neutral' },
    connecting: { title: 'جارٍ تحديث حالة المزامنة', detail: 'تظل النسخة المحلية متاحة أثناء الاتصال.', tone: 'progress' },
    synced: { title: 'المزامنة محدثة', detail: state.activeDevice ? `الجهاز النشط: ${state.activeDevice.label}` : 'اتصل الحساب، لكن هذا الجهاز غير مسجل للرفع.', tone: 'success' },
    offline: { title: 'تعمل دون اتصال', detail: 'نعرض آخر حالة مكتملة محفوظة، وستتحدث عند عودة الاتصال.', tone: 'warning' },
    pending: { title: 'تغييرات بانتظار الإكمال', detail: counts, tone: 'progress' },
    conflict: { title: 'تعارض يحتاج مراجعة', detail: counts, tone: 'warning' },
    quarantined: { title: 'ملف معزول للمراجعة', detail: counts, tone: 'danger' },
    error: { title: 'تعذّر جلب حالة المزامنة', detail: 'لم تتأثر النسخة المحلية. يمكنك إعادة المحاولة لاحقًا.', tone: 'danger' },
  }
  return { ...map[state.phase], canRefresh: Boolean(gateway?.baseUrl && gateway.bookId && gateway.deviceId && gateway.token), canSignIn: state.phase === 'signedOut' && Boolean(gateway?.requestSignIn) }
}

export function localSourceSyncState(phase: 'signedOut' | 'guest' | 'localOnly'): SourceSyncViewState {
  return { phase, uploadAllowed: false, activeDevice: null, revision: null, usage: null, pendingCount: 0, conflictCount: 0, quarantineCount: 0, stale: false, errorCode: null }
}

export async function connectAppSourceSync(gateway: AppSourceSyncGateway | undefined, emit: (state: SourceSyncViewState) => void): Promise<SourceSyncViewState> {
  if (!gateway) { const state = localSourceSyncState('localOnly'); emit(state); return state }
  const identity = await gateway.identity()
  if (identity.kind !== 'authenticated') { const state = localSourceSyncState(identity.kind); emit(state); return state }
  if (!gateway.baseUrl || !gateway.bookId || !gateway.deviceId || !gateway.token) { const state = localSourceSyncState('localOnly'); emit(state); return state }
  const session = new SourceSyncSession(new SourceSyncHttpClient(gateway.baseUrl, gateway.token), gateway.bookId, gateway.deviceId, emit)
  return await session.start(identity)
}

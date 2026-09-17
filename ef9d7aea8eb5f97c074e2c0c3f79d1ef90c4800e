export type CapabilityAvailability = 'available' | 'device-only' | 'connection-required'

export interface OfflineCapability {
  id: 'reading' | 'search' | 'library-data' | 'word-conversion' | 'account-sync'
  label: string
  availability: CapabilityAvailability
  detail: string
}

export function offlineCapabilities(online: boolean, desktopBridgeAvailable = false): OfflineCapability[] {
  return [
    { id: 'reading', label: 'قراءة الكتب المحفوظة', availability: 'available', detail: 'تعمل من تخزين هذا الجهاز.' },
    { id: 'search', label: 'البحث في الكتب المفهرسة', availability: 'available', detail: 'يعمل محليًا بعد فهرسة الكتاب.' },
    { id: 'library-data', label: 'الرفوف والعلامات والملاحظات', availability: 'available', detail: 'تُحفظ وتُعدّل على هذا الجهاز.' },
    { id: 'word-conversion', label: 'تحويل Word إلى PDF', availability: desktopBridgeAvailable ? 'device-only' : 'connection-required', detail: desktopBridgeAvailable ? 'يعمل عبر أداة Word المحلية على هذا الجهاز.' : online ? 'يتطلب محولًا مكتبيًا أو خدمة تحويل متصلة.' : 'مؤجل حتى يتوفر محول مكتبي أو يعود الاتصال.' },
    { id: 'account-sync', label: 'مزامنة الحساب بين الأجهزة', availability: 'connection-required', detail: online ? 'تحتاج حسابًا ومزود مزامنة عند تفعيله.' : 'غير متاحة دون اتصال، وميزة الحساب لم تُفعّل بعد.' },
  ]
}

export function capabilitySummary(items: readonly OfflineCapability[]): { available: number; unavailable: number } {
  return {
    available: items.filter(item => item.availability !== 'connection-required').length,
    unavailable: items.filter(item => item.availability === 'connection-required').length,
  }
}

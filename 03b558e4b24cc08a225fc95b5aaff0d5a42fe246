/** عقد تثبيت الخِزانة كتطبيق واحد على الهاتف وسطح المكتب. */

export type InstallPlatform = 'ios' | 'android' | 'desktop' | 'unknown'

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: InstallPromptEvent | undefined
const listeners = new Set<() => void>()

export function detectInstallPlatform(userAgent: string): InstallPlatform {
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios'
  if (/android/i.test(userAgent)) return 'android'
  if (/windows|macintosh|linux|cros/i.test(userAgent)) return 'desktop'
  return 'unknown'
}

export function isStandalone(displayMode: boolean, navigatorStandalone = false): boolean {
  return displayMode || navigatorStandalone
}

export function installGuidance(platform: InstallPlatform): string {
  if (platform === 'ios') return 'من زر المشاركة اختر «إضافة إلى الشاشة الرئيسية».'
  if (platform === 'android') return 'ثبّت الخِزانة من قائمة المتصفح لتعمل كتطبيق مستقل.'
  if (platform === 'desktop') return 'ثبّت الخِزانة من شريط العنوان لتفتح كتطبيق على جهازك.'
  return 'يمكن تثبيت الخِزانة من قائمة المتصفح على جهازك.'
}

export function installCtaLabel(standalone: boolean, promptAvailable: boolean): string {
  if (standalone) return 'التطبيق مثبت على هذا الجهاز'
  return promptAvailable ? 'تثبيت الخِزانة الآن' : 'التثبيت متاح من المتصفح'
}

export function canPromptInstall(): boolean { return deferredPrompt !== undefined }

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const prompt = deferredPrompt
  if (!prompt) return 'unavailable'
  deferredPrompt = undefined
  await prompt.prompt()
  const choice = await prompt.userChoice
  notify()
  return choice.outcome
}

export function onInstallAvailabilityChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify(): void { listeners.forEach(listener => listener()) }

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    deferredPrompt = event as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = undefined
    notify()
  })
}

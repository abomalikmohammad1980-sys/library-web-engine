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

export function installGuidance(platform: InstallPlatform, userAgent = typeof navigator==='undefined'?'':navigator.userAgent): string {
  if (platform === 'ios') return 'من زر المشاركة اختر «إضافة إلى الشاشة الرئيسية».'
  if (/firefox|waterfox|librewolf|floorp|zen\//i.test(userAgent)) {
    if(platform==='android')return 'من قائمة المتصفح ⋮ اختر «تثبيت» أو «إضافة إلى الشاشة الرئيسية». إن لم يظهر الخيار، احفظ الموقع علامة مرجعية.'
    if(/windows/i.test(userAgent))return 'في Firefox على Windows: اضغط أيقونة تطبيقات الويب في شريط العنوان. تتوفر في Firefox 143 فأحدث (150 لنسخة Microsoft Store)، خارج النافذة الخاصة. المتصفحات المبنية عليه قد لا توفرها؛ إن غابت احفظ الموقع علامة مرجعية، أو افتحه في Edge واختر التطبيقات ← تثبيت هذا الموقع كتطبيق.'
    return 'قد لا يتيح هذا المتصفح تثبيت تطبيق ويب. يمكنك حفظ الموقع علامة مرجعية من قائمة المتصفح للوصول السريع، أو فتحه في متصفح يدعم التثبيت.'
  }
  if (platform === 'android') return 'ثبّت الخِزانة من قائمة المتصفح لتعمل كتطبيق مستقل.'
  if (platform === 'desktop') return 'ثبّت الخِزانة من شريط العنوان لتفتح كتطبيق على جهازك.'
  return 'يمكن تثبيت الخِزانة من قائمة المتصفح على جهازك.'
}

export function installCtaLabel(standalone: boolean, promptAvailable: boolean): string {
  if (standalone) return 'التطبيق مثبت على هذا الجهاز'
  return promptAvailable ? 'تثبيت الخِزانة الآن' : 'طريقة تثبيت التطبيق'
}

export function canPromptInstall(): boolean { return deferredPrompt !== undefined }

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const prompt = deferredPrompt
  if (!prompt) return 'unavailable'
  deferredPrompt = undefined
  try {
    await prompt.prompt()
    const choice = await prompt.userChoice
    return choice.outcome
  } catch { return 'unavailable' }
  finally { notify() }
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

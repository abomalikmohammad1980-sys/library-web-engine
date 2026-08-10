import { guestSessionIdentity } from '../session_identity'
import { icon } from '../icons'
import { h, navigate } from '../ui'
import { canPromptInstall, detectInstallPlatform, installCtaLabel, installGuidance, isStandalone, onInstallAvailabilityChange, promptInstall } from '../install'
import { captureRouteResourceScope } from '../resource_lifecycle'
import { brandMark } from '../brand'

export const WELCOME_SEEN_KEY = 'alkhizana:welcome-seen:v1'

export function welcomeScreen(): HTMLElement {
  const guest = h('button', { class: 'btn btn--primary welcome__primary', type: 'button' }, icon('book', 19), 'الدخول كضيف')
  guest.addEventListener('click', () => {
    guestSessionIdentity()
    localStorage.setItem(WELCOME_SEEN_KEY, '1')
    navigate('#/')
  })
  const account = h('button', { class: 'btn btn--secondary welcome__account', type: 'button', disabled: true, 'aria-label': 'الدخول بحساب — يتاح قريبًا' }, icon('person', 18), 'الدخول بحساب', h('small', null, 'قريبًا'))
  return h('main', { class: 'welcome', id: 'main-content', tabindex: -1 },
    h('nav', { class: 'welcome__nav', 'aria-label': 'رأس صفحة الخزانة' }, h('a', { class: 'welcome__brand', href: '#/welcome', 'aria-label': 'الخِزانة — الصفحة التعريفية' }, brandMark('welcome__brand-mark brand-mark'), h('strong', null, 'الخِزانة')), h('a', { href: '#welcome-features' }, 'الميزات')),
    h('section', { class: 'welcome__hero', 'aria-labelledby': 'welcome-title' },
      h('div', { class: 'welcome__copy' }, h('p', { class: 'page-eyebrow' }, 'مكتبتك الإسلامية الذكية'), h('h1', { id: 'welcome-title' }, 'كتابك كما طُبع، ومعرفتك أقرب إليك'), h('p', null, 'الخِزانة تحفظ ملف Word الأصلي، وتعرض صفحاته بأمانة، وتجمع البحث والفهرسة والملاحظات والـPDF في تجربة قراءة عربية هادئة.'), h('div', { class: 'welcome__actions' }, guest, account), h('small', { class: 'welcome__privacy' }, 'يعمل وضع الضيف على جهازك، ولا يرسل كتبك إلى حساب خارجي.')),
      h('div', { class: 'welcome__art', 'aria-hidden': 'true' }, brandMark('welcome__hero-mark brand-mark')),
    ),
    h('section', { class: 'welcome__features', id: 'welcome-features', 'aria-labelledby': 'welcome-features-title' },
      h('div', { class: 'welcome__section-title' }, h('p', { class: 'page-eyebrow' }, 'لماذا الخِزانة؟'), h('h2', { id: 'welcome-features-title' }, 'أمانة النص وقوة البحث في مكان واحد')),
      h('div', { class: 'welcome__feature-grid' },
        feature('book', 'مطابقة صفحات Word', 'يحافظ على ترتيب الصفحة وترقيمها وصورها وجداولها، مع بقاء الملف الأصلي متاحًا.'),
        feature('search', 'بحث عربي عميق', 'ابحث في كل كتبك أو داخل كتاب واحد، وانتقل إلى المطابقة دون أن تفقد موضع القراءة.'),
        feature('bookmark', 'معرفة تبقى معك', 'احفظ العلامات والتظليلات والملاحظات، ونظّم الكتب في رفوف شخصية تعمل دون اتصال.'),
      ),
    ),
    h('section', { class: 'welcome__platforms', 'aria-label': 'المنصات المدعومة' }, h('div', null, h('p', { class: 'page-eyebrow' }, 'تجربة واحدة'), h('h2', null, 'للويب وسطح المكتب والجوال')), h('div', { class: 'welcome__platform-copy' }, h('p', null, 'واجهة متجاوبة وأساس تطبيق تقدمي، صُمما منذ البداية لتنتقل مكتبتك لاحقًا بين Windows وAndroid وiPhone دون تغيير تجربة القراءة.'), welcomeInstallAction())),
    h('footer', { class: 'welcome__footer' }, brandMark('welcome__footer-mark brand-mark'), h('strong', null, 'الخِزانة'), h('span', null, 'المعرفة أقرب، والكتاب أوفى.')),
  )
}

function welcomeInstallAction(): HTMLElement {
  const resourceScope = captureRouteResourceScope()
  const platform = detectInstallPlatform(navigator.userAgent)
  const standalone = isStandalone(window.matchMedia('(display-mode: standalone)').matches, Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  const guidance = h('small', { class: 'welcome__install-guidance' }, standalone ? 'أنت تستخدم الخِزانة الآن كتطبيق مستقل.' : installGuidance(platform))
  const action = h('button', { class: 'btn btn--primary', type: 'button' }, icon(standalone ? 'check' : 'download', 18), installCtaLabel(standalone, canPromptInstall())) as HTMLButtonElement
  const refresh = (): void => {
    const available = canPromptInstall()
    action.disabled = standalone || !available
    action.lastChild!.textContent = installCtaLabel(standalone, available)
  }
  action.addEventListener('click', async () => {
    const outcome = await promptInstall()
    if (outcome === 'accepted') { action.disabled = true; action.lastChild!.textContent = 'تم تثبيت الخِزانة' }
  })
  refresh()
  const stop = onInstallAvailabilityChange(refresh)
  resourceScope.add(stop)
  return h('div', { class: 'welcome__install', 'aria-live': 'polite' }, guidance, action)
}

function feature(iconName: 'book' | 'search' | 'bookmark', title: string, text: string): HTMLElement {
  return h('article', { class: 'welcome__feature' }, h('span', null, icon(iconName, 25)), h('h3', null, title), h('p', null, text))
}

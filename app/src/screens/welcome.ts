import { guestSessionIdentity } from '../session_identity'
import { icon } from '../icons'
import { h, navigate } from '../ui'
import { canPromptInstall, detectInstallPlatform, installCtaLabel, installGuidance, isStandalone, onInstallAvailabilityChange, promptInstall } from '../install'
import { captureRouteResourceScope } from '../resource_lifecycle'
import { brandMark } from '../brand'
import {showInstallHelp} from '../install_help'
import {homeLibraryStatisticsSection} from '../home_library_statistics'
import {markGuestEntered} from '../account_landing'

export const WELCOME_SEEN_KEY = 'alkhizana:welcome-seen:v1'

export function welcomeScreen(): HTMLElement {
  const guest = h('button', { class: 'btn btn--primary welcome__primary', type: 'button' }, icon('book', 19), 'الدخول كضيف')
  guest.addEventListener('click', () => {
    guestSessionIdentity()
    markGuestEntered()
    navigate('#/')
  })
  const account = h('a', { class: 'btn btn--secondary welcome__account', href: '#/account/sign-in', 'aria-label': 'الدخول بحساب' }, icon('person', 18), 'الدخول بحساب')
  return h('main', { class: 'welcome', id: 'main-content', tabindex: -1 },
    h('nav', { class: 'welcome__nav', 'aria-label': 'رأس صفحة الخزانة' }, h('a', { class: 'welcome__brand', href: '#/welcome', 'aria-label': 'الخِزانة — الصفحة التعريفية' }, brandMark('welcome__brand-mark brand-mark'), h('strong', null, 'الخِزانة')), h('a', { href: '#/features' }, 'الميزات')),
    h('section', { class: 'welcome__hero', 'aria-labelledby': 'welcome-title' },
      h('div', { class: 'welcome__copy' }, h('p', { class: 'page-eyebrow' }, 'مكتبتك الإسلامية الذكية'), h('h1', { id: 'welcome-title' }, 'كتابك كما طُبع، ومعرفتك أقرب إليك'), h('p', null, 'الخِزانة تحفظ ملف Word الأصلي، وتعرض صفحاته بأمانة، وتجمع البحث والفهرسة والملاحظات والـPDF في تجربة قراءة عربية هادئة.'), h('div', { class: 'welcome__actions' }, guest, account), h('small', { class: 'welcome__privacy' }, 'يعمل وضع الضيف على جهازك، ولا يرسل كتبك إلى حساب خارجي.')),
      h('div', { class: 'welcome__art', 'aria-hidden': 'true' }, brandMark('welcome__hero-mark brand-mark')),
    ),
    homeLibraryStatisticsSection(),
    h('section', { class: 'welcome__features', id: 'welcome-features', 'aria-labelledby': 'welcome-features-title' },
      h('div', { class: 'welcome__section-title' }, h('p', { class: 'page-eyebrow' }, 'لماذا الخِزانة؟'), h('h2', { id: 'welcome-features-title' }, 'أمانة النص وقوة البحث في مكان واحد')),
      h('div', { class: 'welcome__feature-grid' },
        feature('book', 'جميع كتب المكتبة الشاملة', 'تصفح الكتب ومؤلفيها وتصنيفاتها وفهارسها، وأضف كتبك الشخصية بصيغ Word وPDF وEPUB وBOK.'),
        feature('book', 'المصحف وخدمات التفسير', 'اقرأ بالرسم العثماني، وابحث في الآيات، واستفد من التفاسير والتلاوة الصوتية وخدمات القرآن.'),
        feature('search', 'السنة النبوية', 'تصفح مصادر الحديث وابحث في متونه، مع عرض التخريج والدرجة حين تتوفر بيانات موثقة.'),
        feature('search', 'قراءة وبحث بالعربية', 'فهرس قابل للبحث، وفلاتر للعناوين والمؤلفين، وانتقال إلى مواضع النتائج، مع خيارات الخط وسمات القراءة.'),
        feature('bookmark', 'العلامات والملاحظات والتظليل', 'احفظ موضع القراءة والنصوص المظللة والملاحظات، وانسخ الفوائد مع توثيق الكتاب والمؤلف والصفحة.'),
        feature('bookmark', 'تنظيم القراءة والبحث', 'رتب كتبك في رفوف، وأنشئ خطط قراءة ومشاريع بحثية، واحفظ اقتباساتك وراجع مقتطفاتك.'),
      ),
      h('a',{class:'welcome__features-link',href:'#/features'},'استعرض جميع الميزات وما يجري تطويره ←'),
    ),
    h('section', { class: 'welcome__platforms', 'aria-label': 'المنصات المدعومة' }, h('h2', null, 'تجربة واحدة للويب وسطح المكتب والجوال'), h('div', { class: 'welcome__platform-copy' }, h('p', null, 'تصفح الخزانة في Windows وAndroid وiPhone دون تغيير تجربة القراءة'), welcomeInstallAction())),
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
    action.disabled = standalone
    action.lastChild!.textContent = installCtaLabel(standalone, available)
  }
  action.addEventListener('click', async () => {
    if(!canPromptInstall()){showInstallHelp();return}
    const outcome = await promptInstall()
    if (outcome === 'accepted') { action.disabled = true; action.lastChild!.textContent = 'تم قبول طلب التثبيت' }
    if(outcome==='unavailable')showInstallHelp()
  })
  refresh()
  const stop = onInstallAvailabilityChange(refresh)
  resourceScope.add(stop)
  return h('div', { class: 'welcome__install', 'aria-live': 'polite' }, guidance, action)
}

function feature(iconName: 'book' | 'search' | 'bookmark', title: string, text: string): HTMLElement {
  return h('article', { class: 'welcome__feature' }, h('span', null, icon(iconName, 25)), h('h3', null, title), h('p', null, text))
}

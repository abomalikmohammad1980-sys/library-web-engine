import { h } from '../ui'
import { pageContent } from '../components'
import { icon } from '../icons'
import { listBooks } from '../engine/library_store'
import { currentReviewStreak, getReadingActivity, reviewedToday } from '../activity_store'
import { getAnnotations } from '../annotation_store'
import { canPromptInstall, detectInstallPlatform, installGuidance, isStandalone, onInstallAvailabilityChange, promptInstall } from '../install'
import { guestSessionIdentity, identityLabel } from '../session_identity'
import { mountStateView, stateView } from '../state_view'
import { listReadingPlans } from '../reading_plan'
import { buildReadingInsights } from '../reading_insights'
import { arabicNum } from '../ui'
import { captureRouteResourceScope } from '../resource_lifecycle'
import { brandMark } from '../brand'

export function meScreen(): HTMLElement {
  const identity = guestSessionIdentity()
  const root = pageContent(
    h('section', { class: 'me-hero', 'aria-labelledby': 'me-title' },
      h('p', { class: 'page-eyebrow' }, 'أنا'),
      h('h1', { class: 'page-title', id: 'me-title' }, 'مساحتك في الخِزانة'),
      h('p', { class: 'page-sub' }, 'قراءاتك وكتبك وإنجازك اليومي محفوظة على هذا الجهاز.'),
      h('p', { class: 'me-identity', role: 'status' }, icon('person', 16), `أنت داخل بصفة ${identityLabel(identity)} لهذه الجلسة`),
    ),
  )
  const content = stateView({ kind: 'loading', icon: 'person', title: 'جارٍ إعداد ملخصك' })
  root.appendChild(content)
  void hydrate(content)
  return root
}

async function hydrate(root: HTMLElement): Promise<void> {
  try {
    const books = await listBooks()
    const activity = getReadingActivity()
    const last = books.find((book) => book.id === activity.lastBookId)
    const readyPdf = books.filter((book) => book.pdfStatus === 'ready').length
    const annotations = getAnnotations()
    const plans = listReadingPlans()
    const insights = buildReadingInsights(activity)
    const bookmarkCount = Object.values(annotations.bookmarks).reduce((sum, pages) => sum + pages.length, 0)
    const stats = h('section', { class: 'me-stats', 'aria-label': 'ملخص نشاط القراءة' },
      stat('book', String(books.length), 'كتاب في مكتبتك'),
      stat('clock', String(activity.openedBookIds.length), 'كتاب بدأت قراءته'),
      stat('check', String(currentReviewStreak(activity)), 'أيام مراجعة متتالية'),
    )
    const quick = h('section', { class: 'me-actions', 'aria-labelledby': 'me-actions-title' },
      h('h2', { id: 'me-actions-title' }, 'وصول سريع'),
      h('div', { class: 'me-action-grid' },
        last ? action('book', 'تابع آخر قراءة', last.title, `#/reader/${last.id}`) : action('plus', 'ابدأ القراءة', 'اختر كتابًا من مكتبتك', '#/library'),
        action('download', 'ملفات PDF الجاهزة', `${readyPdf} من ${books.length}`, '#/browse'),
        action('person', 'المؤلفون', 'تصفح الكتب بحسب المؤلف', '#/authors'),
        action('book', 'رفوفي الشخصية', 'نظّم ما تقرأ وما أتممت', '#/shelves'),
        action('clock', 'خطط القراءة', `${plans.length} ${plans.length === 1 ? 'خطة فعّالة' : 'خطط فعّالة'}`, '#/reading-plans'),
        action('bookmark', 'علاماتي وملاحظاتي', `${bookmarkCount} علامة · ${annotations.notes.length} ملاحظة · ${annotations.highlights.length} تظليل`, '#/notes'),
        action('bookmark', 'مشاريعي البحثية', 'اجمع الفوائد في ملفات موضوعية', '#/research-projects'),
        action('book', 'مركز الطبعات', 'قارن النسخ والتحقيقات الموجودة', '#/editions'),
        action('book', 'السلاسل العلمية', 'رتّب الكتب المرتبطة في مسارات موثقة', '#/series'),
        action('settings', 'جودة بيانات المكتبة', 'اكشف النواقص والتعارضات وأصلحها', '#/data-quality'),
        action('settings', 'إعدادات القراءة والوصول', 'الحجم والتباين والحركة وتصدير البيانات', '#/settings'),
      ),
    )
    const today = h('div', { class: `me-today${reviewedToday(activity) ? ' me-today--done' : ''}` }, icon('check', 22), h('div', null, h('strong', null, reviewedToday(activity) ? 'أنجزت مراجعة اليوم' : 'مراجعة اليوم لم تُنجز بعد'), h('p', null, reviewedToday(activity) ? 'سُجل إنجازك على هذا الجهاز.' : 'عد إلى لوحة اليوم وسجّل إنجازك عندما تنتهي.')))
    root.className = 'me-content'
    root.removeAttribute('role')
    const insightPanel = h('section', { class: 'reading-insights', 'aria-labelledby': 'reading-insights-title' },
      h('div', { class: 'section-header' }, h('div', null, h('h2', { id: 'reading-insights-title' }, 'إيقاع قراءتك'), h('p', null, 'آخر أربعة أسابيع على هذا الجهاز'))),
      h('div', { class: 'reading-insights__summary' }, h('strong', null, `${arabicNum(insights.activeDays)} يومًا نشطًا`), h('span', null, `${arabicNum(insights.totalOpens)} فتحة كتاب`), h('span', null, `${arabicNum(insights.completionPercent)}٪ من الأيام`)),
      h('div', { class: 'reading-heatmap', role: 'img', 'aria-label': `${arabicNum(insights.activeDays)} يوم قراءة من آخر ${arabicNum(insights.days.length)} يومًا` }, ...insights.days.map(day => h('span', { class: `reading-heatmap__day${day.active ? ' is-active' : ''}`, title: day.key, 'aria-hidden': 'true' }))),
    )
    root.replaceChildren(installPanel(), stats, insightPanel, today, quick)
  } catch {
    mountStateView(root, { kind: 'error', title: 'تعذّر إعداد الملخص الآن', description: 'بيانات القراءة محفوظة؛ أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: () => void hydrate(root) })
  }
}

function installPanel(): HTMLElement {
  const resourceScope = captureRouteResourceScope()
  const platform = detectInstallPlatform(navigator.userAgent)
  const standalone = isStandalone(window.matchMedia('(display-mode: standalone)').matches, Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  const panel = h('section', { class: `me-install${standalone ? ' me-install--ready' : ''}`, 'aria-labelledby': 'install-app-title' })
  const copy = h('div', null,
    h('p', { class: 'page-eyebrow' }, standalone ? 'التطبيق مثبت' : 'تطبيق واحد لكل أجهزتك'),
    h('h2', { id: 'install-app-title' }, standalone ? 'الخِزانة تعمل كتطبيق مستقل' : 'ثبّت الخِزانة على هذا الجهاز'),
    h('p', null, standalone ? 'تفتح الآن في نافذة تطبيق، وتبقى مكتبتك المحلية متاحة على هذا الجهاز.' : installGuidance(platform)),
  )
  const action = h('button', { class: 'btn btn--primary', type: 'button' }, standalone ? 'مثبّت' : 'تثبيت التطبيق') as HTMLButtonElement
  action.disabled = standalone || !canPromptInstall()
  const refresh = (): void => {
    action.disabled = standalone || !canPromptInstall()
    if (!standalone && !canPromptInstall() && platform === 'ios') action.textContent = 'اتبع خطوات المشاركة'
  }
  action.addEventListener('click', async () => {
    const outcome = await promptInstall()
    if (outcome === 'accepted') { action.textContent = 'تم التثبيت'; action.disabled = true }
  })
  refresh()
  const unsubscribe = onInstallAvailabilityChange(refresh)
  resourceScope.add(unsubscribe)
  panel.append(brandMark('me-install__brand brand-mark'), copy, action)
  return panel
}

function stat(iconName: 'book' | 'clock' | 'check', value: string, label: string): HTMLElement {
  return h('article', { class: 'me-stat' }, icon(iconName, 22), h('strong', null, value), h('span', null, label))
}

function action(iconName: 'book' | 'plus' | 'download' | 'person' | 'bookmark' | 'settings' | 'clock', title: string, text: string, href: string): HTMLElement {
  return h('a', { class: 'me-action', href }, h('span', { class: 'me-action__icon' }, icon(iconName, 22)), h('span', null, h('strong', null, title), h('small', null, text)), icon('chevron-left', 18))
}

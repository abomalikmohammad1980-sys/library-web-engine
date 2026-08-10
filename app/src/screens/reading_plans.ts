import { pageContent } from '../components'
import { listBooks } from '../engine/library_store'
import { listReadingPlans, readingPosition } from '../reading_plan'
import { buildReadingJourneys } from '../reading_journeys'
import { mountStateView, stateView } from '../state_view'
import { arabicNum, h } from '../ui'

export function readingPlansScreen(): HTMLElement {
  const root = pageContent(
    h('section', { class: 'reading-plans-hero', 'aria-labelledby': 'reading-plans-title' },
      h('p', { class: 'page-eyebrow' }, 'رحلات القراءة'),
      h('h1', { class: 'page-title', id: 'reading-plans-title' }, 'خططك في مشهد واحد'),
      h('p', { class: 'page-sub' }, 'تابع ورد اليوم، واعرف ما أنجزت وما بقي من كل كتاب.'),
    ),
  )
  const content = stateView({ kind: 'loading', icon: 'clock', title: 'جارٍ إعداد خطط القراءة' })
  root.appendChild(content)
  void hydratePlans(content)
  return root
}

async function hydratePlans(root: HTMLElement): Promise<void> {
  try {
    const books = await listBooks()
    const journeys = buildReadingJourneys(listReadingPlans(), books, readingPosition)
    if (!journeys.length) {
      mountStateView(root, { kind: 'empty', icon: 'clock', title: 'لا توجد خطة قراءة فعالة', description: 'افتح صفحة كتاب وحدد الوقت المتاح يوميًا لتبدأ رحلة واضحة.', actionLabel: 'اختر كتابًا', href: '#/library' })
      return
    }
    root.className = 'reading-plans-grid'
    root.removeAttribute('role')
    root.replaceChildren(...journeys.map(journey => h('article', { class: 'reading-journey' },
      h('div', { class: 'reading-journey__head' }, h('div', null, h('h2', null, journey.title), h('p', null, journey.author || 'مؤلف غير معروف')), h('strong', null, `${arabicNum(journey.progress.percent)}٪`)),
      h('div', { class: 'reading-plan__track', 'aria-hidden': 'true' }, h('span', { style: `width:${journey.progress.percent}%` })),
      h('div', { class: 'reading-journey__status' },
        h('span', null, `وصلت إلى الصفحة ${arabicNum(journey.progress.currentPage)}`),
        h('span', null, journey.plan.pausedAt ? 'الخطة متوقفة مؤقتًا ولا يتراكم الورد' : journey.pagesBehindToday ? `ورد اليوم: ${arabicNum(journey.pagesBehindToday)} صفحة للحاق بالهدف` : journey.progress.remainingPages ? 'أنت على هدف اليوم أو أمامه' : 'أتممت الكتاب بحمد الله'),
        h('span', null, journey.progress.remainingPages ? `نحو ${arabicNum(journey.progress.daysRemaining)} أيام متبقية` : 'الخطة مكتملة'),
      ),
      h('div', { class: 'reading-journey__actions' }, h('a', { class: 'btn btn--primary', href: `#/reader/${journey.plan.bookId}` }, 'اقرأ الآن')),
    )))
  } catch {
    mountStateView(root, { kind: 'error', title: 'تعذّر فتح خطط القراءة', description: 'الخطط محفوظة على جهازك؛ أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: () => void hydratePlans(root) })
  }
}

import { pageContent } from '../components'
import { listBooks } from '../engine/library_store'
import { listReadingPlans, readingPosition } from '../reading_plan'
import { buildReadingJourneys } from '../reading_journeys'
import { mountStateView, stateView } from '../state_view'
import { silentSkeleton } from '../silent_skeleton'
import { arabicNum, h } from '../ui'
import { publicPageHero } from '../public_page_hero'
import { bookOrdinal } from '../book_ordering'
import { authorLink, categoryLink, effectiveBookCategory } from '../taxonomy_links'
import { uiTemplateAttribute, uiTemplateText } from '../ui_template_binding'
import {readingPlanPanel} from './book'
import {captureReadingIdentity} from '../reading_identity_scope'
import {captureRouteResourceScope,routeEventListener} from '../resource_lifecycle'

export function readingPlansScreen(): HTMLElement {
  const scope=captureRouteResourceScope()
  const root = pageContent(
    publicPageHero({ eyebrow: 'رحلات القراءة', title: 'خططك في مشهد واحد', titleId: 'reading-plans-title', description: 'تابع ورد اليوم، واعرف ما أنجزت وما بقي من كل كتاب.', className: 'reading-plans-hero' }),
  )
  const content = h('section', { class: 'reading-plans-grid', 'aria-busy': 'true' }, silentSkeleton('cards'))
  root.appendChild(content)
  void hydratePlans(content)
  routeEventListener(window,'alkhizana:account-changed',()=>{content.replaceChildren();delete content.dataset.selectedBook;void hydratePlans(content)},undefined,scope)
  return root
}

async function hydratePlans(root: HTMLElement): Promise<void> {
  try {
    const identity=captureReadingIdentity()
    const books = await listBooks()
    if(!identity.isCurrent())return
    const journeys = buildReadingJourneys(listReadingPlans(), books, readingPosition)
    const choice=h('select',{'aria-label':'اختر كتابًا للخطة'},h('option',{value:''},'اختر كتابًا'),...books.map(book=>h('option',{value:book.id,dataset:{noTranslate:''}},book.title))) as HTMLSelectElement
    const editor=h('div',{class:'reading-plans-editor'})
    choice.disabled=!books.length
    const composer=h('section',{class:'reading-plans-composer'},h('h2',null,'إنشاء خطة قراءة أو تعديلها'),choice,editor)
    if(!books.length)composer.append(h('a',{class:'btn btn--secondary',href:'#/library'},'أضف كتابًا إلى مكتبتك أولًا'))
    choice.value=root.dataset.selectedBook??''
    const showEditor=()=>{if(!identity.isCurrent())return;root.dataset.selectedBook=choice.value;const book=books.find(book=>book.id===choice.value);editor.replaceChildren(...(book?[readingPlanPanel(book,()=>void hydratePlans(root))]:[]))}
    choice.addEventListener('change',showEditor);showEditor()
    root.removeAttribute('aria-busy')
    if (!journeys.length) {
      root.replaceChildren(composer,stateView({ kind: 'empty', icon: 'clock', title: 'لا توجد خطة قراءة فعالة', description: 'اختر كتابًا من القائمة وحدد وقتك اليومي لإنشاء خطة هنا.' }))
      return
    }
    root.className = 'reading-plans-grid'
    root.removeAttribute('role')
    root.replaceChildren(composer,...journeys.map((journey, index) => {
      const ordinal = bookOrdinal(index)
      const readerHref = `#/reader/${journey.plan.bookId}`
      const card = h('article', { class: 'reading-journey', style: 'position:relative', 'aria-label': `${ordinal.label}: ${journey.title}` },
      h('a', { class: 'reading-journey__surface', href: readerHref, style: 'position:absolute;inset:0;z-index:1', 'aria-label': `افتح ${journey.title}` }),
      h('span', { class: 'book-card__ordinal', 'aria-hidden': 'true', style: 'position:relative;z-index:2;pointer-events:none' }, arabicNum(ordinal.number)),
      h('div', { class: 'reading-journey__head', style: 'position:relative;z-index:2;pointer-events:none' }, h('div', null,
        h('h2', { dataset: { noTranslate: '' } }, journey.title),
        h('p', { class: 'reading-journey__links', style: 'pointer-events:auto' },
          authorLink(journey.author, undefined, journey.authorId),
          document.createTextNode(' · '),
          h('span', { dataset: { noTranslate: '' } }, categoryLink(effectiveBookCategory(journey))))),
      h('strong', null, `${arabicNum(journey.progress.percent)}٪`)),
      h('div', { class: 'reading-plan__track', 'aria-hidden': 'true' }, h('span', { style: `width:${journey.progress.percent}%` })),
      h('div', { class: 'reading-journey__status' },
        h('span', null, uiTemplateText('68ff67efebd87ca7',{p1:journey.progress.currentPage})),
        h('span', null, journey.plan.pausedAt ? 'الخطة متوقفة مؤقتًا ولا يتراكم الورد' : journey.pagesBehindToday ? uiTemplateText('3f3a447940a02ca7',{p1:journey.pagesBehindToday}) : journey.progress.remainingPages ? 'أنت على هدف اليوم أو أمامه' : 'أتممت الكتاب بحمد الله'),
        h('span', null, journey.progress.remainingPages ? uiTemplateText('4438c273159ce8e3',{p1:journey.progress.daysRemaining}) : 'الخطة مكتملة'),
      ),
      h('div', { class: 'reading-journey__actions', style: 'position:relative;z-index:2;pointer-events:none' }, h('a', { class: 'btn btn--primary', href: readerHref, style: 'pointer-events:auto' }, 'اقرأ الآن')),
    )
      uiTemplateAttribute(card, 'aria-label', 'afecb05314ef7e20', {p1:ordinal.number,p2:journey.title})
      uiTemplateAttribute(card.querySelector('.reading-journey__surface')!, 'aria-label', '8353b16eaeab196c', {p1:journey.title})
      return card
    }))
  } catch {
    root.removeAttribute('aria-busy')
    mountStateView(root, { kind: 'error', title: 'تعذّر فتح خطط القراءة', description: 'الخطط محفوظة على جهازك؛ أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: () => void hydratePlans(root) })
  }
}

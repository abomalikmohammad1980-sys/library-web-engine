import { h, type Child } from '../ui'
import { uiTemplateText,uiTemplateAttribute,uiLabelParameter } from '../ui_template_binding'
import { pageContent } from '../components'
import { icon } from '../icons'
import { listBooks, readPrivateLibrarySnapshot, type StoredBook } from '../engine/library_store'
import { currentReviewStreak, getReadingActivity, reviewedToday } from '../activity_store'
import { getAnnotations } from '../annotation_store'
import { canPromptInstall, detectInstallPlatform, installGuidance, isStandalone, onInstallAvailabilityChange, promptInstall } from '../install'
import { accountEntryHref } from '../account_entry'
import { mountStateView, stateView } from '../state_view'
import { listReadingPlans } from '../reading_plan'
import { buildReadingInsights } from '../reading_insights'
import { arabicNum } from '../ui'
import { captureRouteResourceScope, routeEventListener } from '../resource_lifecycle'
import { brandMark } from '../brand'
import { currentAccountClaims, hasAccountPermission } from '../account_authority'
import { silentSkeleton } from '../silent_skeleton'
import { publicPageHero } from '../public_page_hero'
import { bindAuthorDisplayName } from '../author_display_names'
import { captureReadingIdentity } from '../reading_identity_scope'
import { bookOrdinal, compareBooksByMetric, orderedBooks } from '../book_ordering'
import { libraryCenturyRows, libraryTopCategoryRows, type LibraryStatRow } from '../me_library_stats'

import {booksWithAuthorChronology} from '../library_author_chronology'
import {showInstallHelp} from '../install_help'

export function meScreen(): HTMLElement {
  const resourceScope = captureRouteResourceScope()
  const identityNode = h('p', { class: 'me-identity', role: 'status' })
  const descriptionNode = h('p', { class: 'page-sub' })
  const accountSlot = h('div', { class: 'me-account-slot' })
  let renderedAccountKey: string | undefined
  const renderAccount = (): void => {
    if (resourceScope.disposed) return
    const claims = currentAccountClaims()
    const accountKey = JSON.stringify(claims)
    if (accountKey === renderedAccountKey) return
    renderedAccountKey = accountKey
    descriptionNode.textContent = claims ? 'قراءاتي وكتبي وإنجازي اليومي محفوظة ضمن هذا الحساب' : 'قراءاتي وكتبي وإنجازي اليومي محفوظة على هذا الجهاز'
    if (claims) {
      const name = claims.displayName?.trim()
      identityNode.replaceChildren(icon('person', 16), 'حياكم الله ونتمنى لك قراءة نافعة', ...(name ? [' يا ', h('span', { dataset: { noTranslate: '' } }, name)] : []))
    } else identityNode.replaceChildren(icon('person', 16), 'حياكم الله حضرة الضيف، سجل الدخول بنقرة زر من ', h('a', { href: accountEntryHref(routeLocation.hash), dataset: { guestSignIn: 'identity' } }, 'هنا'), ' وتمتع بكامل ميزات المشتركين')
    if(claims)accountSlot.replaceChildren(h('a',{href:'#/account/sign-in',class:'btn btn--secondary'},'تعديل الاسم واسم المستخدم'))
    else accountSlot.replaceChildren(h('section', { class: 'me-private-library', 'aria-labelledby': 'guest-account-books-title' },
      h('h2', { id: 'guest-account-books-title' }, 'كتب حسابي'),
      h('a', { class: 'btn btn--primary', href: accountEntryHref(routeLocation.hash), dataset: { guestSignIn: 'books' } }, 'تسجيل الدخول'),
    ))
  }
  const root = pageContent(
    publicPageHero({ eyebrow: '', title: 'مساحتي في الخزانة', titleId: 'me-title', className: 'me-hero', after: [descriptionNode, identityNode] }),
  )
  let privateLibrary = privateLibraryOverview()
  const content = h('section', { 'aria-busy': 'true' }, silentSkeleton('cards'))
  root.append(privateLibrary)
  root.append(accountSlot)
  root.append(content)
  let hydrateGeneration = 0
  const refresh = (): void => {
    if (resourceScope.disposed) return
    const generation = ++hydrateGeneration
    const identity = captureReadingIdentity()
    content.setAttribute('aria-busy', 'true')
    content.replaceChildren(silentSkeleton('cards'))
    const updatedPrivateLibrary = privateLibraryOverview()
    privateLibrary.replaceWith(updatedPrivateLibrary)
    privateLibrary = updatedPrivateLibrary
    void hydrate(content, () => !resourceScope.disposed && generation === hydrateGeneration && identity.isCurrent(), refresh)
  }
  routeEventListener(window, 'alkhizana:account-changed', () => { renderAccount(); refresh() }, undefined, resourceScope)
  renderAccount()
  // يعاد بناء الملخص والإحصاءات معًا عند تغير الكتالوج؛ تحديث الرقم وحده
  // كان يترك مخططي القرون والتصنيفات على لقطة قديمة.
  routeEventListener(window, 'library-changed', refresh, undefined, resourceScope)
  refresh()
  return root
}


type PrivateBookSnapshot = Partial<StoredBook> & Pick<StoredBook, 'id' | 'title' | 'author'>

function privateLibraryOverview(): HTMLElement {
  let books: PrivateBookSnapshot[] = []
  try {
    const parsed = readPrivateLibrarySnapshot()
    books = parsed
  } catch { /* IndexedDB hydration below remains authoritative. */ }

  const query = h('input', { type: 'search', placeholder: 'ابحث في كتبي…', 'aria-label': 'البحث الفوري في كتبي الخاصة' }) as HTMLInputElement
  const category = h('select', { 'aria-label': 'تصفية كتبي حسب التصنيف' }, h('option', { value: '' }, 'كل التصنيفات')) as HTMLSelectElement
  const author = h('select', { 'aria-label': 'تصفية كتبي حسب المؤلف' }, h('option', { value: '' }, 'كل المؤلفين')) as HTMLSelectElement
  const categories = [...new Set(books.map(book => book.category?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'ar'))
  const authors = [...new Set(books.map(book => book.author?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'))
  categories.forEach(value => category.appendChild(h('option', { value, dataset: { noTranslate: '' } }, value)))
  authors.forEach(value => author.appendChild(h('option', { value, dataset: { noTranslate: '' } }, value)))
  const results = h('div', { class: 'me-private-library__results', id: 'me-private-library-results', role: 'list', tabindex: -1, 'aria-live': 'polite' })
  const render = (): void => {
    const needle = query.value.trim().toLocaleLowerCase('ar')
    const filtered = orderedBooks(books.filter(book =>
      (!needle || (book.title + ' ' + book.author).toLocaleLowerCase('ar').includes(needle))
      && (!category.value || book.category === category.value)
      && (!author.value || book.author === author.value),
    ))
    results.replaceChildren(...filtered.slice(0, 9).map((book, index) => {
      const ordinal = bookOrdinal(index)
      const ordinalNode = h('span', { class: 'me-private-library__ordinal' }, arabicNum(ordinal.number))
      uiTemplateAttribute(ordinalNode, 'aria-label', '2ad0367328ba34be', { p1: ordinal.number })
      return h('a', { class: 'me-private-library__book', href: '#/reader/' + encodeURIComponent(book.id), role: 'listitem' },
        ordinalNode,
        h('strong', { dataset: { noTranslate: '' } }, book.title),
        book.author ? bindAuthorDisplayName(h('small', { dataset: { noTranslate: '' } }, book.author), book.authorId, book.author) : h('small', null, 'مؤلف غير مثبت'),
      )
    }))
    if (!filtered.length) results.appendChild(h('p', { class: 'me-private-library__empty' }, books.length ? 'لا توجد كتب مطابقة.' : 'أضف كتابًا ليظهر هنا فورًا.'))
  }
  query.addEventListener('input', render)
  category.addEventListener('change', render)
  author.addEventListener('change', render)
  const filter = h('form', { class: 'me-private-library__filter', 'aria-label': 'البحث والتصفية في كتبي الخاصة' },
    icon('search', 19), query, category, author,
    h('button', { class: 'btn btn--secondary', type: 'button', onclick: () => { query.value = ''; category.value = ''; author.value = ''; render() } }, 'مسح'),
  )
  filter.setAttribute('aria-controls', results.id)
  filter.addEventListener('submit', event => event.preventDefault())

  const gateway = (value: string, kind: 'category' | 'author'): HTMLElement => {
    const button = h('button', {
      class: 'me-private-library__gateway', type: 'button', dataset: { noTranslate: '' }, onclick: () => {
      if (kind === 'category') category.value = value
      else author.value = value
      render()
      results.focus({ preventScroll: true })
      },
    }, value)
    button.setAttribute('aria-controls', results.id)
    return button
  }

  const taxonomy = h('div', { class: 'me-private-library__gateways' },
    h('section', { 'aria-labelledby': 'me-private-categories' }, h('h3', { id: 'me-private-categories' }, 'التصنيفات'), h('div', { class: 'me-private-library__gateway-list' }, ...(categories.length ? categories.slice(0, 6).map(value => gateway(value, 'category')) : [h('p', null, 'لا تصنيفات بعد')]))),
    h('section', { 'aria-labelledby': 'me-private-authors' }, h('h3', { id: 'me-private-authors' }, 'المؤلفون'), h('div', { class: 'me-private-library__gateway-list' }, ...(authors.length ? authors.slice(0, 6).map(value => gateway(value, 'author')) : [h('p', null, 'لا مؤلفين بعد')]))),
  )
  const activity = getReadingActivity()
  const popular = [...books].filter(book => (activity.openCounts[book.id] ?? 0) > 0).sort(compareBooksByMetric(book => activity.openCounts[book.id] ?? 0)).slice(0, 6)
  const popularSection = h('section', { class: 'me-private-library__popular', 'aria-labelledby': 'me-private-popular' },
    h('h3', { id: 'me-private-popular' }, 'الكتب الأكثر استعمالًا'),
    h('div', { class: 'me-private-library__popular-list' }, ...(popular.length ? popular.map(book => h('a', { href: '#/reader/' + encodeURIComponent(book.id), dataset: { noTranslate: '' } }, book.title)) : [h('p', null, 'تظهر هنا الكتب بعد بدء قراءتها.')])),
  )
  render()
  return h('section', { class: 'me-private-library', 'aria-labelledby': 'me-private-library-title' },
    h('div', { class: 'section-header' }, h('div', null, h('p', { class: 'page-eyebrow' }, 'مكتبتي'), h('h2', { id: 'me-private-library-title' }, 'كتبك الخاصة مباشرة'))),
    filter, taxonomy, popularSection, results,
  )
}
async function hydrate(root: HTMLElement, isCurrent: () => boolean, refresh: () => void): Promise<void> {
  try {
    const books = await listBooks()
    if (!isCurrent()) return
    const activity = getReadingActivity()
    const last = books.find((book) => book.id === activity.lastBookId)
    const readyPdf = books.filter((book) => book.pdfStatus === 'ready').length
    const annotations = getAnnotations()
    const plans = listReadingPlans()
    const insights = buildReadingInsights(activity)
    const bookmarkCount = Object.values(annotations.bookmarks).reduce((sum, pages) => sum + pages.length, 0)
    const stats = h('section', { class: 'me-stats', 'aria-label': 'ملخص نشاط القراءة' },
      stat('book', String(books.length), 'كتاب في مكتبتك', 'libraryBookCount'),
      stat('clock', String(activity.openedBookIds.length), 'كتاب بدأت قراءته'),
      stat('check', String(currentReviewStreak(activity)), 'أيام مراجعة متتالية'),
    )
    const quick = h('section', { class: 'me-actions', 'aria-labelledby': 'me-actions-title' },
      h('h2', { id: 'me-actions-title' }, 'وصول سريع'),
      h('div', { class: 'me-action-grid' },
        last ? action('book', 'تابع آخر قراءة', last.title, `#/reader/${last.id}`, true) : action('plus', 'ابدأ القراءة', 'اختر كتابًا من مكتبتك', '#/library'),
        action('download', 'ملفات PDF الجاهزة', uiTemplateText('3c57cd7ed4ada710', { p1: readyPdf, p2: books.length }), '#/browse'),
        action('person', 'المؤلفون', 'تصفح الكتب بحسب المؤلف', '#/authors'),
        action('book', 'رفوفي الشخصية', 'نظّم ما تقرأ وما أتممت', '#/shelves'),
        action('clock', 'خطط القراءة', uiTemplateText(plans.length===1?'2b7be0ffc1f68bd2':'009bc736bc2b1c6c',{p1:plans.length}), '#/reading-plans'),
        action('bookmark', 'علاماتي وملاحظاتي', uiTemplateText('3d4348206d8d1702', { p1: bookmarkCount, p2: annotations.notes.length, p3: annotations.highlights.length }), '#/notes'),
        action('bookmark', 'التظليلات', uiTemplateText('110c9ea0c4e05a5c', { p1: annotations.highlights.length }), '#/notes?kind=highlight'),
        action('bookmark', 'مشاريعي البحثية', 'اجمع الفوائد في ملفات موضوعية', '#/research-projects'),
        action('book', 'مركز الطبعات', 'قارن النسخ والتحقيقات الموجودة', '#/editions'),
        action('book', 'السلاسل العلمية', 'رتّب الكتب المرتبطة في مسارات موثقة', '#/series'),
        action('settings', 'جودة بيانات المكتبة', 'اكشف النواقص والتعارضات وأصلحها', '#/data-quality'),
        action('settings', 'إعدادات القراءة والوصول', 'الحجم والتباين والحركة وتصدير البيانات', '#/settings'),
        ...(hasAccountPermission(currentAccountClaims(), 'book:review-submissions')
          ? [action('settings', hasAccountPermission(currentAccountClaims(), 'book:edit-published-metadata') ? 'إدارة الكتب المنشورة' : 'مراجعة إضافات المستخدمين', hasAccountPermission(currentAccountClaims(), 'book:edit-published-metadata') ? 'مراجعة الإضافات وتعديل بيانات الكتب المثبتة وظهورها' : 'مراجعة الكتب المرسلة للنشر العام', '#/admin/books')]
          : []),
      ),
    )
    const today = h('div', { class: `me-today${reviewedToday(activity) ? ' me-today--done' : ''}` }, icon('check', 22), h('div', null, h('strong', null, reviewedToday(activity) ? 'أنجزت مراجعة اليوم' : 'مراجعة اليوم لم تُنجز بعد'), h('p', null, reviewedToday(activity) ? 'سُجل إنجازك على هذا الجهاز.' : 'عد إلى لوحة اليوم وسجّل إنجازك عندما تنتهي.')))
    root.className = 'me-content'
    root.removeAttribute('role')
    root.removeAttribute('aria-busy')
    const dayDetails = h('p', { role: 'status', 'aria-live': 'polite' })
    const insightPanel = h('section', { class: 'reading-insights', 'aria-labelledby': 'reading-insights-title' },
      h('div', { class: 'section-header' }, h('div', null, h('h2', { id: 'reading-insights-title' }, 'إيقاع قراءتك'), h('p', null, 'آخر أربعة أسابيع على هذا الجهاز'))),
      h('div', { class: 'reading-insights__summary' }, h('strong', null, uiTemplateText('56512eee503840fc', { p1: insights.activeDays })), h('span', null, uiTemplateText('b6ff6e76ed12f0cd', { p1: insights.totalOpens })), h('span', null, uiTemplateText('6407678d6c7e9b54', { p1: insights.completionPercent }))),
      h('div', { class: 'reading-heatmap', role: 'group', 'aria-label': `${arabicNum(insights.activeDays)} يوم قراءة من آخر ${arabicNum(insights.days.length)} يومًا` }, ...insights.days.map(day => h('button', { type: 'button', class: `reading-heatmap__day${day.active ? ' is-active' : ''}`, title: day.key, 'aria-label': day.key, onclick: () => {
        if (!isCurrent()) return
        dayDetails.replaceChildren(h('strong', null, day.key), h('span', null, day.active ? ' — سُجلت مراجعة في هذا اليوم.' : ' — لم تُسجل مراجعة في هذا اليوم.'), h('span', null, ' لا يتوفر سجل مفصل لكتب هذا اليوم.'))
      } }))), dayDetails,
    )
    uiTemplateAttribute(insightPanel.querySelector('.reading-heatmap')!,'aria-label','90ea1fcc9dae5b46',{p1:insights.activeDays,p2:insights.days.length})
    const chronologyBooks=await booksWithAuthorChronology(books).catch(()=>null)
    if(!isCurrent())return
    const libraryDistribution = h('section', { class: 'me-library-distribution', 'aria-label': 'إحصاءات كتب المكتبة' },
      chronologyBooks?libraryChart('خمسة عشر قرنًا هجريًا من التأليف', 'توزيع الكتب بحسب سنة وفاة المؤلف', libraryCenturyRows(chronologyBooks), 'century'):h('article',{class:'me-library-chart'},h('h2',null,'خمسة عشر قرنًا هجريًا من التأليف'),h('p',null,'تعذّر تحميل تواريخ المؤلفين الموثقة؛ أعد المحاولة عند توفر الاتصال.')),
      libraryChart('أكبر عشرة تصنيفات', 'عدد الكتب ونسبتها من مجموع كتب المكتبة.', libraryTopCategoryRows(books), 'category', books.length),
    )
    root.replaceChildren(installPanel(), stats, libraryDistribution, insightPanel, today, quick)
  } catch {
    if (!isCurrent()) return
    root.removeAttribute('aria-busy')
    mountStateView(root, { kind: 'error', title: 'تعذّر إعداد الملخص الآن', description: 'بيانات القراءة محفوظة؛ أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: refresh })
  }
}

export function libraryChart(title: string, description: string, rows: LibraryStatRow[], kind: 'century' | 'category', total=rows.reduce((sum,row)=>sum+row.count,0)): HTMLElement {
  return h('article', { class: `me-library-chart me-library-chart--${kind}` },
    h('h2', null, title), h('p', null, description),
    h('div', { class: 'me-library-chart__rows', role: 'list' }, ...rows.map(row => {
      const percent=total>0?row.count/total*100:0
      const countNode=h('span', { class: 'me-library-chart__count',dataset:{noTranslate:''},dir:'ltr' },`${row.count.toLocaleString('en-US')} · ${percent.toFixed(1)}%`)
      uiTemplateAttribute(countNode,'aria-label','d546cb9b56523fa3',{p1:row.count})
      return h('div', { class: 'me-library-chart__row', role: 'listitem' },
      h('strong', kind==='category'?{dataset:{noTranslate:''}}:null, row.centuryDisplay?uiTemplateText('e606c13a24136385',{p1:uiLabelParameter(row.centuryDisplay.ordinal),p2:row.centuryDisplay.gregorianRange}):row.label),
      h('span', { class: 'me-library-chart__track', 'aria-hidden': 'true' }, h('span', { style: `inline-size:${percent}%` })),
      countNode,
    )})),
  )
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
  action.disabled = standalone
  const refresh = (): void => {
    action.disabled = standalone
    if (!standalone) action.textContent = canPromptInstall()?'تثبيت التطبيق':'طريقة تثبيت التطبيق'
  }
  action.addEventListener('click', async () => {
    if(!canPromptInstall()){showInstallHelp();return}
    const outcome = await promptInstall()
    if (outcome === 'accepted') { action.textContent = 'تم قبول طلب التثبيت'; action.disabled = true }
    if(outcome==='unavailable')showInstallHelp()
  })
  refresh()
  const unsubscribe = onInstallAvailabilityChange(refresh)
  resourceScope.add(unsubscribe)
  panel.append(brandMark('me-install__brand brand-mark'), copy, action)
  return panel
}

function stat(iconName: 'book' | 'clock' | 'check', value: string, label: string, valueRole?: 'libraryBookCount'): HTMLElement {
  return h('article', { class: 'me-stat' }, icon(iconName, 22), h('strong', valueRole ? { dataset: { libraryBookCount: '' } } : null, value), h('span', null, label))
}

function action(iconName: 'book' | 'plus' | 'download' | 'person' | 'bookmark' | 'settings' | 'clock', title: string, text: Child, href: string, protectText = false): HTMLElement {
  return h('a', { class: 'me-action', href }, h('span', { class: 'me-action__icon' }, icon(iconName, 22)), h('span', null, h('strong', null, title), h('small', protectText ? { dataset: { noTranslate: '' } } : null, text)), icon('chevron-left', 18))
}
import {routeLocation} from "../path_location"

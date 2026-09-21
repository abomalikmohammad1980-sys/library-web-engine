/* هيكل التطبيق: AppHeader + BottomNav (الدستور §6 — الهيكل والتنقل) */

import { h, type Child } from './ui'
import { icon } from './icons'
import { attachLiveSearch, compactLiveSearchTabTarget } from './live_search'
import { watchConnectivity } from './connectivity'
import { captureRouteResourceScope, routeEventListener, routeTimeout } from './resource_lifecycle'
import { brandMark } from './brand'
import { getSettings, saveSettings, type AppSettings, type AppTheme } from './settings_store'
import { translationButton } from './translation'
import { uiLabelParameter, uiTemplateAttribute } from './ui_template_binding'
import { headerBookAddControl } from './header_book_add'
import { chooseRemembrance } from './remembrances'
import { visitorCounter } from './visitor_counter'
import { destination, destinationActive, type DestinationId } from './navigation_destinations'
import { readerReturnBar } from './reader_return_bar'
import { currentAccountClaims } from './account_authority'
import { cloudflareAccessAuthProvider, accountErrorArabic } from './account_service'
import { accountEntryHref } from './account_entry'
import { toast } from './ui'

const GATEWAYS = (['library', 'discover', 'me'] as DestinationId[]).map(destination)

let activeHeaderSearch: HTMLInputElement | undefined
document.addEventListener('keydown', (event) => {
  if (event.key === 'F3') {
    event.preventDefault()
    routeLocation.hash = '#/search'
  }
})

export function appHeader(currentHash: string): HTMLElement {
  const header = h('header', { class: 'app-header' })
  const isReader = currentHash.startsWith('#/reader/')
  if (isReader) header.classList.add('app-header--reader')
  const inner = h('div', { class: 'app-header__inner' })

  const logo = h('a', { class: 'app-logo', href: '#/', 'aria-label': 'الخِزانة — الصفحة الرئيسية' })
  const mark = brandMark('app-logo__mark brand-mark')
  logo.appendChild(mark)
  logo.appendChild(h('span', { class: 'app-logo__name' }, 'الخِزانة'))

  const nav = h('nav', { class: 'app-header__nav', 'aria-label': 'التنقل الرئيسي' })
  const tabs = (['quran', 'sunnah', 'library', 'authors'] as DestinationId[]).map(destination)
  for (const t of tabs) {
    const active = destinationActive(t, currentHash)
    nav.appendChild(
      h('a', {
        href: t.href,
        'aria-current': active ? 'true' : undefined,
      }, t.label),
    )
  }

  inner.appendChild(logo)
  inner.appendChild(nav)
  inner.appendChild(h('div', { class: 'app-header__spacer' }))

  const servicesButton=h('button',{class:'app-header__services-button',type:'button','aria-label':'فتح قائمة خدمات الخِزانة','aria-expanded':'false'},icon('compass',20),h('span',null,'الخدمات')) as HTMLButtonElement
  servicesButton.setAttribute('aria-haspopup','menu')
  const servicesMenu=h('nav',{class:'app-header__services-menu','aria-label':'جميع خدمات الخِزانة',hidden:true},
    ...([
      'library','quran','sunnah','authors','search','discover','features','shelves','reading-plans','settings',
    ] as DestinationId[]).map(destination).map(item=>h('a',{href:item.href},icon(item.icon,18),h('span',null,item.label))),
  )
  const services=h('div',{class:'app-header__services'},servicesButton,servicesMenu)
  const closeServices=(restore=false)=>{if(servicesMenu.hidden)return;servicesMenu.hidden=true;servicesButton.setAttribute('aria-expanded','false');if(restore)servicesButton.focus()}
  servicesButton.addEventListener('click',()=>{const opening=servicesMenu.hidden;servicesMenu.hidden=!opening;servicesButton.setAttribute('aria-expanded',String(opening));if(opening)servicesMenu.querySelector<HTMLAnchorElement>('a')?.focus()})
  servicesMenu.addEventListener('click',event=>{if((event.target as Element).closest('a'))closeServices()})
  const scope=captureRouteResourceScope()
  routeEventListener(document,'keydown',(event:Event)=>{if((event as KeyboardEvent).key==='Escape')closeServices(true)},undefined,scope)
  routeEventListener(document,'pointerdown',(event:Event)=>{if(!services.contains(event.target as Node))closeServices()},undefined,scope)
  inner.appendChild(services)

  const search = h('div', { class: 'search-field app-header__search', role: 'search' })
  const searchInput = h('input', { type: 'search', placeholder: 'ابحث في كل كتبك…', 'aria-label': 'بحث في المكتبة' }) as HTMLInputElement
  const searchButton=h('a',{class:'app-header__search-button',href:'#/search','aria-label':'فتح صفحة البحث العام','aria-expanded':'false'},icon('search',19),h('span',null,'بحث')) as HTMLAnchorElement
  activeHeaderSearch = searchInput
  search.append(searchButton, searchInput)
  attachLiveSearch(searchInput, search)
  const compactSearch = (): boolean => window.matchMedia('(max-width: 1100px)').matches
  const closeCompactSearch = (restoreFocus = false): void => {
    if (!search.classList.contains('is-open')) return
    search.classList.remove('is-open')
    search.closest('.app-header')?.classList.remove('app-header--search-open')
    searchButton.setAttribute('aria-expanded', 'false')
    searchInput.blur()
    if (restoreFocus) searchButton.focus()
  }
  searchButton.addEventListener('click', event => {
    if (!compactSearch()) return
    event.preventDefault()
    if (!search.classList.contains('is-open')) search.classList.add('is-open')
    search.closest('.app-header')?.classList.add('app-header--search-open')
    searchButton.setAttribute('aria-expanded', 'true')
    searchInput.focus()
  })
  routeEventListener(document, 'keydown', (event: Event) => {
    const key = event as KeyboardEvent
    if (!compactSearch() || !search.classList.contains('is-open')) return
    if (key.key === 'Escape') { closeCompactSearch(true); return }
    if (key.key !== 'Tab') return
    const focusable = [searchButton, searchInput, ...search.querySelectorAll<HTMLElement>('.live-search a, .live-search button')].filter(item => !item.hidden && !item.closest('[hidden]'))
    const target = compactLiveSearchTabTarget(focusable, document.activeElement as HTMLElement | undefined, key.shiftKey)
    if (target) { key.preventDefault(); target.focus() }
  }, undefined, scope)
  routeEventListener(document, 'pointerdown', (event: Event) => {
    if (compactSearch() && !search.contains(event.target as Node)) closeCompactSearch()
  }, undefined, scope)
  inner.appendChild(search)

  const themeNames: Record<AppTheme, string> = { original: 'أصلي', light: 'أبيض', dark: 'أسود', sepia: 'بني' }
  const selectedTheme = getSettings().theme ?? 'original'
  const theme = h('details', { class: 'app-header__theme', 'aria-label': 'اختيار ألوان الخِزانة' }) as HTMLDetailsElement
  const themeSummary = h('summary', null,
    icon('palette', 22),
  )
  uiTemplateAttribute(themeSummary, 'title', '127cf7acc8c02167', { p1: uiLabelParameter(themeNames[selectedTheme]) })
  uiTemplateAttribute(themeSummary, 'aria-label', '127cf7acc8c02167', { p1: uiLabelParameter(themeNames[selectedTheme]) })
  const themeMenu = h('div', { class: 'app-header__theme-menu', role: 'menu', 'aria-label': 'ألوان الخِزانة' })
  const updateThemeControl = (value: AppTheme): void => {
    uiTemplateAttribute(themeSummary, 'title', '127cf7acc8c02167', { p1: uiLabelParameter(themeNames[value]) })
    uiTemplateAttribute(themeSummary, 'aria-label', '127cf7acc8c02167', { p1: uiLabelParameter(themeNames[value]) })
    for (const item of themeMenu.querySelectorAll<HTMLElement>('[role="menuitemradio"]')) item.setAttribute('aria-checked', String(item.dataset.theme === value))
  }
  for (const value of ['original', 'light', 'dark', 'sepia'] as AppTheme[]) {
    const choice = h('button', {
      type: 'button', role: 'menuitemradio', 'aria-checked': value === selectedTheme ? 'true' : 'false',
      class: 'app-header__theme-choice', dataset: { theme: value },
      onclick: () => {
        saveSettings({ ...getSettings(), theme: value })
        updateThemeControl(value)
        theme.open = false
      },
    }, h('span', { class: `app-header__theme-swatch app-header__theme-swatch--${value}`, 'aria-hidden': 'true' }), themeNames[value])
    themeMenu.appendChild(choice)
  }
  routeEventListener(window, 'alkhizana:settings-changed', (event: Event) => {
    const next = (event as CustomEvent<AppSettings>).detail?.theme
    updateThemeControl(next === 'light' || next === 'dark' || next === 'sepia' ? next : 'original')
  }, undefined, captureRouteResourceScope())
  theme.append(themeSummary, themeMenu)
  inner.appendChild(theme)
  inner.appendChild(translationButton('app-header__translation'))
  inner.appendChild(headerBookAddControl())

  const account = h(
    'a',
    { class: 'app-header__account', href: '#/me', 'aria-label': 'أنا — مساحتك في الخِزانة' },
    icon('person', 20),
    h('span', null, 'أنا'),
  )
  const settings = h(
    'a',
    {
      class: 'app-header__settings',
      href: '#/settings',
      title: 'الإعدادات',
      'aria-label': 'فتح الإعدادات',
      'aria-current': currentHash.startsWith('#/settings') ? 'page' : undefined,
    },
    icon('settings', 20),
  )
  inner.appendChild(settings)
  inner.appendChild(account)
  const auth = h('a', { class: 'app-header__auth', href: accountEntryHref(routeLocation.hash) }, 'تسجيل الدخول') as HTMLAnchorElement
  const refreshAuth = (): void => {
    const signedIn = Boolean(currentAccountClaims())
    const label = signedIn ? 'تسجيل الخروج' : 'تسجيل الدخول'
    auth.setAttribute('aria-label', label); auth.title = label
    auth.replaceChildren(icon(signedIn ? 'arrow-back' : 'person', 22))
    auth.href = legacyHashToPath(accountEntryHref(routeLocation.hash))
    if (signedIn) auth.setAttribute('role', 'button')
    else auth.removeAttribute('role')
  }
  auth.addEventListener('click', event => {
    if (!currentAccountClaims()) return
    event.preventDefault()
    void cloudflareAccessAuthProvider.signOut().catch(error => toast(accountErrorArabic(error)))
  })
  auth.addEventListener('keydown', event => {
    if (event.key === ' ' && currentAccountClaims()) { event.preventDefault(); auth.click() }
  })
  routeEventListener(window, 'alkhizana:account-changed', refreshAuth, undefined, scope)
  refreshAuth()
  inner.appendChild(auth)

  header.appendChild(inner)
  return header
}

export function bottomNav(currentHash: string): HTMLElement {
  const nav = h('nav', { class: 'bottom-nav', 'aria-label': 'التنقل السفلي' })
  const inner = h('div', { class: 'bottom-nav__inner' })
  for (const g of GATEWAYS) {
    const active = destinationActive(g, currentHash)
    const btn = h(
      'a',
      { href: g.href, 'aria-current': active ? 'page' : undefined },
      icon(g.icon, 24),
      h('span', null, g.label),
    )
    inner.appendChild(btn)
  }
  nav.appendChild(inner)
  return nav
}

/** الإطار العام للشاشات (باستثناء القارئ الذي له تخطيطه الخاص) */
export function appFrame(content: Child, currentHash: string): HTMLElement {
  const frame = h('div', { class: 'app-frame' })
  frame.appendChild(skipToContent())
  frame.appendChild(appHeader(currentHash))
  frame.appendChild(connectivityBanner())
  const returnBar = readerReturnBar()
  if (returnBar) frame.appendChild(returnBar)
  frame.appendChild(h('main', { class: 'app-main', id: 'main-content', tabindex: -1 }, content))
  frame.appendChild(siteFooter())
  frame.appendChild(bottomNav(currentHash))
  return frame
}

export function siteFooter(): HTMLElement {
  const internal = [
    ['الميزات', '#/features'],
    ['مكتبتي', '#/library'], ['البحث', '#/search'], ['المؤلفون', '#/authors'],
    ['رفوفي', '#/shelves'], ['الإعدادات', '#/settings'],
  ] as const
  return h('footer', { class: 'site-footer', 'aria-label': 'تذييل موقع الخِزانة' },
    h('div', { class: 'site-footer__inner' },
      h('a', { class: 'site-footer__brand', href: '#/', 'aria-label': 'الخِزانة — الصفحة الرئيسية' }, brandMark('site-footer__mark brand-mark'), h('span', null, h('strong', null, 'الخِزانة'), h('small', null, 'مكتبة عربية للقراءة والبحث والتنظيم'))),
      h('nav', { class: 'site-footer__links', 'aria-label': 'خدمات الخِزانة' }, ...internal.map(([label, href]) => h('a', { href, ...(label === 'الميزات' ? { 'aria-label': 'ميزات الخِزانة' } : {}) }, ...(label === 'الميزات' ? [icon('features', 18)] : []), h('span', null, label)))),
      h('nav', { class: 'site-footer__social', 'aria-label': 'متابعة مشروع الخِزانة والتواصل' },
        h('a', { href: 'https://t.me/khezana1448', target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'قناة متابعة الخِزانة على تيليجرام' }, icon('telegram', 18), h('span', null, 'قناة المتابعة')),
        h('a', { href: 'https://t.me/khezaana', target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'التواصل مع الخِزانة على تيليجرام' }, icon('telegram', 18), h('span', null, 'التواصل')),
      ),
      h('div', { class: 'site-footer__bottom' },
        h('p', { class: 'site-footer__rights' }, 'حقوق النشر محفوظة لكل مسلم، وكل خدماتنا مجانية في سبيل الله: طلب العلم فريضة، فانشر تُؤجر'),
        visitorCounter(),
        h('details', { class: 'site-footer__privacy' }, h('summary', null, 'خصوصية إحصاءات الزيارة'), h('p', null, 'نستخدم معرّفًا عشوائيًا في ملف ارتباط لمدة سنة لعدّ المتصفحات، ونحفظ البلد التقريبي دون عنوان IP أو موقع دقيق في سجل الإحصاء. التقارير الإجمالية للإدارة فقط. سنة الميلاد اختيارية في إعدادات الحساب، ولا تدخل إحصاءات العمر إلا بموافقتك التي يمكنك سحبها وحذف السنة.')),
      ),
    ),
  )
}

/** تذكير وجيز في أول صفحة من جلسة التصفح؛ يختفي تلقائيًا بعد عشر ثوان. */
export function globalRemembrance(): HTMLElement {
  const sessionKey = 'khizana:remembrance-shown:v2'
  if (sessionStorage.getItem(sessionKey)) return h('span', { hidden: true, 'aria-hidden': 'true' })
  sessionStorage.setItem(sessionKey, '1')
  const scope = captureRouteResourceScope(), selected = chooseRemembrance()
  const reminder = h('aside', {
    class: 'global-remembrance', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true',
    'aria-label': selected.kind === 'authentic-remembrance' ? 'تذكير بذكر مأثور' : 'دعاء عام', dir: 'rtl',
    dataset: { remembranceId: selected.id, remembranceKind: selected.kind, sourceUrl: selected.sourceUrl ?? '' },
  }, selected.text)
  routeTimeout(() => { reminder.classList.add('is-leaving'); routeTimeout(() => reminder.remove(), 260, scope) }, 10_000, scope)
  return reminder
}

/** عقد توافق للقارئ القديم؛ أزيل الشريط العام نفسه من جميع الصفحات. */
export function runtimeEnvironmentNotice(): HTMLElement {
  return h('span', { hidden: true, 'aria-hidden': 'true' })
}

export function skipToContent(): HTMLButtonElement {
  return h('button', { class: 'skip-link', type: 'button', onclick: () => document.getElementById('main-content')?.focus({ preventScroll: false }) }, 'تجاوز إلى المحتوى') as HTMLButtonElement
}

function connectivityBanner(): HTMLElement {
  const resourceScope = captureRouteResourceScope()
  const banner = h('div', { class: 'connectivity-banner', role: 'status', 'aria-live': 'polite', hidden: true })
  let hasBeenOffline = false
  const stop = watchConnectivity(state => {
    if (!state.online) hasBeenOffline = true
    banner.hidden = state.online && !hasBeenOffline
    banner.classList.toggle('connectivity-banner--online', state.online)
    banner.replaceChildren(icon(state.online ? 'check' : 'globe', 17), h('span', null, state.message))
    if (state.online && hasBeenOffline) routeTimeout(() => { banner.hidden = true; hasBeenOffline = false }, 3500, resourceScope)
  })
  resourceScope.add(stop)
  return banner
}
import {routeLocation,legacyHashToPath} from "./path_location"

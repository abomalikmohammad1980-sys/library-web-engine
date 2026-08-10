/* الموجّه — مع دعم المكتبة المحفوظة */

import { homeScreen } from './screens/home'
import { browseScreen } from './screens/browse'
import { libraryScreen, authorsScreen, authorBooksScreen } from './screens/library'
import { searchScreen } from './screens/search'
import { appFrame, globalRemembrance } from './shell'
import { meScreen } from './screens/me'
import { recordBookOpened } from './activity_store'
import { settingsScreen } from './screens/settings'
import { notesScreen } from './screens/notes'
import { shelvesScreen } from './screens/shelves'
import { welcomeScreen, WELCOME_SEEN_KEY } from './screens/welcome'
import { readingPlansScreen } from './screens/reading_plans'
import { researchProjectsScreen } from './screens/research_projects'
import { editionsScreen } from './screens/editions'
import { seriesScreen } from './screens/series'
import { dataQualityScreen } from './screens/data_quality'
import { focusRouteContent, routeDocumentTitle } from './navigation_accessibility'
import { beginRouteResourceScope } from './resource_lifecycle'
import { h } from './ui'
import { stateView } from './state_view'
import { quranScreen, quranTafsirBookScreen } from './screens/quran'
import { sunnahScreen, sunnahSourceScreen } from './screens/sunnah'
import { restoreSelectedSiteLanguage, setSourceDocumentTitle } from './translation'

interface Route {
  name: 'welcome' | 'home' | 'quran' | 'quran-tafsir' | 'sunnah' | 'sunnah-source' | 'browse' | 'reader' | 'book' | 'shelves' | 'reading-plans' | 'research-projects' | 'editions' | 'series' | 'data-quality' | 'me' | 'settings' | 'notes' | 'library' | 'authors' | 'author' | 'search'
  param?: string
}

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').split('?')[0] ?? ''
  const parts = clean.split('/').filter(Boolean)
  if (parts.length === 0) return localStorage.getItem(WELCOME_SEEN_KEY) ? { name: 'home' } : { name: 'welcome' }
  const [first, second] = parts
  if (first === 'welcome') return { name: 'welcome' }
  if (first === 'browse') return { name: 'browse' }
  if (first === 'quran' && second === 'tafsir' && parts.length >= 3) return { name: 'quran-tafsir', param: parts.slice(2, 5).join('/') }
  if (first === 'quran') return { name: 'quran' }
  if (first === 'sunnah' && second === 'source' && parts[2]) return { name: 'sunnah-source', param: decodeURIComponent(parts[2]) }
  if (first === 'sunnah') return { name: 'sunnah' }
  if (first === 'reader' && second) return { name: 'reader', param: second }
  // الروابط القديمة لصفحة الكتاب تفتح القارئ مباشرة؛ بطاقة الكتاب صارت داخله.
  if (first === 'book' && second) return { name: 'reader', param: second }
  if (first === 'shelves') return { name: 'shelves' }
  if (first === 'reading-plans') return { name: 'reading-plans' }
  if (first === 'research-projects') return { name: 'research-projects' }
  if (first === 'editions') return { name: 'editions' }
  if (first === 'series') return { name: 'series' }
  if (first === 'data-quality') return { name: 'data-quality' }
  if (first === 'me') return { name: 'me' }
  if (first === 'settings') return { name: 'settings' }
  if (first === 'notes') return { name: 'notes' }
  if (first === 'library') return { name: 'library' }
  if (first === 'search') return { name: 'search' }
  if (first === 'authors') return { name: 'authors' }
  if (first === 'author' && second) return { name: 'author', param: decodeURIComponent(second) }
  return { name: 'home' }
}

let renderGeneration = 0

export function render(focusMain = false): void {
  const generation = ++renderGeneration
  beginRouteResourceScope()
  const route = parseHash(location.hash)
  const root = document.getElementById('app')
  if (!root) return
  const titleRoute = route.name === 'quran-tafsir' ? 'quran' : route.name === 'sunnah-source' ? 'sunnah' : route.name
  setSourceDocumentTitle(routeDocumentTitle(titleRoute))

  let content: HTMLElement
  if (route.name === 'welcome') {
    content = welcomeScreen()
  } else if (route.name === 'reader' && route.param) {
    const bookId = route.param
    recordBookOpened(bookId)
    const loading = h('main', { class: 'reader-route-loading', id: 'main-content', tabindex: -1 }, stateView({ kind: 'loading', icon: 'book', title: 'جارٍ فتح القارئ', description: 'تظهر واجهة القراءة أولًا ثم تُحمّل أدوات الصيغة المطلوبة.' }))
    root.replaceChildren(loading)
    if (focusMain) focusRouteContent(root)
    void import('./screens/reader').then(({ readerScreen }) => {
      // إذا غادر المستخدم قبل اكتمال chunk فلا نعيده إلى الكتاب القديم.
      if (generation !== renderGeneration || parseHash(location.hash).name !== 'reader') return
      root.replaceChildren(readerScreen(bookId), globalRemembrance())
      restoreSelectedSiteLanguage()
      if (focusMain) focusRouteContent(root)
    }).catch(() => {
      if (generation !== renderGeneration) return
      loading.replaceChildren(stateView({ kind: 'error', title: 'تعذّر تحميل أدوات القارئ', description: 'الكتاب لم يتغير. تحقق من الاتصال ثم أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: () => render(true) }))
    })
    return
  } else if (route.name === 'browse') {
    content = appFrame(browseScreen(), '#/browse')
  } else if (route.name === 'quran') {
    content = appFrame(quranScreen(), '#/quran')
  } else if (route.name === 'sunnah') {
    content = appFrame(sunnahScreen(), '#/sunnah')
  } else if (route.name === 'sunnah-source' && route.param) {
    content = appFrame(sunnahSourceScreen(route.param), '#/sunnah')
  } else if (route.name === 'quran-tafsir' && route.param) {
    content = appFrame(quranTafsirBookScreen(route.param), '#/quran')
  } else if (route.name === 'shelves') {
    content = appFrame(shelvesScreen(), '#/library')
  } else if (route.name === 'reading-plans') {
    content = appFrame(readingPlansScreen(), '#/me')
  } else if (route.name === 'research-projects') {
    content = appFrame(researchProjectsScreen(), '#/me')
  } else if (route.name === 'editions') {
    content = appFrame(editionsScreen(), '#/library')
  } else if (route.name === 'series') {
    content = appFrame(seriesScreen(), '#/library')
  } else if (route.name === 'data-quality') {
    content = appFrame(dataQualityScreen(), '#/library')
  } else if (route.name === 'search') {
    content = appFrame(searchScreen(), '#/search')
  } else if (route.name === 'library') {
    content = appFrame(libraryScreen(), '#/library')
  } else if (route.name === 'authors') {
    content = appFrame(authorsScreen(), '#/authors')
  } else if (route.name === 'author' && route.param) {
    content = appFrame(authorBooksScreen(route.param), '#/authors')
  } else if (route.name === 'me') {
    content = appFrame(meScreen(), '#/me')
  } else if (route.name === 'settings') {
    content = appFrame(settingsScreen(), '#/me')
  } else if (route.name === 'notes') {
    content = appFrame(notesScreen(), '#/me')
  } else {
    content = appFrame(homeScreen(), '#/')
  }

  root.replaceChildren(content, globalRemembrance())
  // لا تُترجم شجرة الصفحة قبل تركيبها؛ أعد تطبيق اختيار المستخدم بعد كل انتقال.
  restoreSelectedSiteLanguage()
  if (focusMain) focusRouteContent(root)
}

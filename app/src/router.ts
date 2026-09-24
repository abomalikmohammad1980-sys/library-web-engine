/* الموجّه — كل شاشة في chunk مستقل لتبقى بداية Vite باردة وخفيفة. */

import { recordBookOpened } from './activity_store'
import { resolveCanonicalBookDeepLink, type CanonicalBookRoute } from './canonical_book_routes'
import { focusRouteContent, routeDocumentTitle } from './navigation_accessibility'
import { markModuleLoaded, shouldReloadStaleModule } from './module_chunk_recovery'
import { markReaderChunkLoaded, shouldReloadReaderChunk } from './reader_chunk_recovery'
import { beginRouteResourceScope } from './resource_lifecycle'
import { readerLoadingPaper } from './reader_loading'
import { decodeRouteParam } from './route_params'
import { canonicalShamelaBookId } from './shamela_public_identity'
import {canonicalReaderHash,resolveBookAlias} from './book_alias_registry'
import { appFrame, globalRemembrance } from './shell'
import { stateView } from './state_view'
import { restoreSelectedSiteLanguage, setSourceDocumentTitle } from './translation'
import { h } from './ui'
import {createReaderIdlePrewarm,readerPrewarmRouteEligible} from './reader_idle_prewarm'
import {accountLandingRoute} from './account_landing'
import {hydrateSubjectCategories} from './subject_categories'
import {hydrateAuthorDisplayNames} from './author_display_names'
import {validRouteShape} from './route_shape'
import {bindPageMeta} from './page_meta'
import {routeNeedsMetadataBeforeRender} from './route_metadata_policy'

export {WELCOME_SEEN_KEY} from './account_landing'

interface Route {
  name: 'categories' | 'recommendations' | 'not-found' | 'welcome' | 'home' | 'quotes' | 'new-books' | 'features' | 'quran' | 'quran-tafsir' | 'sunnah' | 'sunnah-source' | 'browse' | 'reader' | 'book' | 'shelves' | 'reading-plans' | 'research-projects' | 'editions' | 'series' | 'data-quality' | 'me' | 'settings' | 'notes' | 'library' | 'authors' | 'author' | 'people' | 'search' | 'admin-books' | 'sign-in'
  param?: string
  canonicalHash?: string
}

export function parseHash(hash: string, bookRoutes: readonly CanonicalBookRoute[] = []): Route {
  const clean = hash.replace(/^#\/?/, '').split('?')[0] ?? ''
  const parts = clean.split('/').filter(Boolean)
  if (parts.length === 0) return {name:accountLandingRoute()}
  if(!validRouteShape(parts))return {name:'not-found'}
  const [first, second] = parts
  if (first === 'categories') return {name:'categories',...(second?{param:decodeRouteParam(second)}:{})}
  if (first === 'welcome') return {name:accountLandingRoute(true)}
  if (first === 'features') return { name: 'features' }
  if (first === 'quotes') return {name:'quotes'}
  if (first === 'new-books') return { name: 'new-books' }
  if (first === 'recommendations') return { name: 'recommendations' }
  if (first === 'browse') return { name: 'browse' }
  if (first === 'quran' && second === 'tafsir' && parts.length >= 3) return { name: 'quran-tafsir', param: parts.slice(2, 5).join('/') }
  if (first === 'quran') return { name: 'quran' }
  if (first === 'sunnah' && second === 'source' && parts[2]) return { name: 'sunnah-source', param: decodeURIComponent(parts[2]) }
  if (first === 'sunnah') return { name: 'sunnah' }
  if (first === 'reader' && second) {
    const decoded=decodeRouteParam(second),shamelaCanonical=canonicalShamelaBookId(decoded)
    let canonical=shamelaCanonical
    try{if(typeof localStorage!=='undefined')canonical=resolveBookAlias(localStorage,shamelaCanonical)}catch(error){console.warn('book_alias_resolution_deferred',error)}
    const query=hash.includes('?')?hash.split('?').slice(1).join('?'):''
    return{name:'reader',param:canonical,...(canonical===decoded?{}:{canonicalHash:canonicalReaderHash(canonical,query)})}
  }
  if (first === 'book' && second) {
    const segment = decodeRouteParam(second)
    const query = hash.includes('?') ? hash.split('?').slice(1).join('?') : ''
    const resolved = resolveCanonicalBookDeepLink(bookRoutes, segment, query)
    return resolved
      ? { name: 'reader', param: resolved.publicId, ...(resolved.canonicalHash ? { canonicalHash: resolved.canonicalHash } : {}) }
      : { name: 'reader', param: segment }
  }
  if (first === 'shelves') return { name: 'shelves' }
  if (first === 'reading-plans') return { name: 'reading-plans' }
  if (first === 'research-projects') return { name: 'research-projects' }
  if (first === 'editions') return { name: 'editions' }
  if (first === 'series') return { name: 'series' }
  if (first === 'data-quality') return { name: 'data-quality' }
  if (first === 'admin' && second === 'books') return { name: 'admin-books' }
  if (first === 'account' && second === 'sign-in') return { name: 'sign-in' }
  if (first === 'me') return { name: 'me' }
  if (first === 'settings') return { name: 'settings' }
  if (first === 'notes') return { name: 'notes' }
  if (first === 'library') return { name: 'library' }
  if (first === 'search') return { name: 'search' }
  if (first === 'authors') return { name: 'authors' }
  if (first === 'people' && second) return { name: 'people', param: decodeURIComponent(second) }
  if (first === 'author' && second) return { name: 'author', param: decodeURIComponent(second) }
  return { name: 'not-found' }
}

export function parseLocation(pathname=location.pathname,search=location.search,bookRoutes:readonly CanonicalBookRoute[]=[]):Route{
 if(pathname==='/')return{name:'home'}
 return parseHash(locationRouteHash({pathname,search,hash:''}),bookRoutes)
}

type ResolvedScreen = { content: HTMLElement; activeHash: string }
type RouteLoader = (route: Route) => Promise<ResolvedScreen>

const routeLoaders: Record<Exclude<Route['name'], 'reader' | 'book'>, RouteLoader> = {
  categories:async route=>({content:(await import('./screens/categories')).categoriesScreen(route.param),activeHash:'#/browse'}),
  recommendations:async()=>({content:(await import('./screens/recommendations')).recommendationsScreen(),activeHash:'#/'}),
  'not-found':async()=>({content:h('main',{id:'main-content',tabindex:-1,class:'page-content'},h('h1',null,'404 — الصفحة غير موجودة'),h('p',null,'الرابط غير صحيح أو أن الصفحة لم تعد متاحة.'),h('a',{href:'#/',class:'btn btn--primary'},'العودة إلى الرئيسية')),activeHash:''}),
  quotes: async () => ({content:(await import('./screens/quotes')).quotesScreen(),activeHash:'#/'}),
  welcome: async () => ({ content: (await import('./screens/welcome')).welcomeScreen(), activeHash: '#/welcome' }),
  home: async () => ({ content: (await import('./screens/home')).homeScreen(), activeHash: '#/' }),
  'new-books': async () => ({ content: (await import('./screens/new_books')).newBooksScreen(), activeHash: '#/' }),
  features: async () => ({ content: (await import('./screens/features')).featuresScreen(), activeHash: '#/features' }),
  browse: async () => ({ content: (await import('./screens/browse')).browseScreen(), activeHash: '#/browse' }),
  quran: async () => ({ content: (await import('./screens/quran')).quranScreen(), activeHash: '#/quran' }),
  'quran-tafsir': async route => ({ content: (await import('./screens/quran')).quranTafsirBookScreen(route.param!), activeHash: '#/quran' }),
  sunnah: async () => ({ content: (await import('./screens/sunnah')).sunnahScreen(), activeHash: '#/sunnah' }),
  'sunnah-source': async route => ({ content: (await import('./screens/sunnah')).sunnahSourceScreen(route.param!), activeHash: '#/sunnah' }),
  shelves: async () => ({ content: (await import('./screens/shelves')).shelvesScreen(), activeHash: '#/library' }),
  'reading-plans': async () => ({ content: (await import('./screens/reading_plans')).readingPlansScreen(), activeHash: '#/me' }),
  'research-projects': async () => ({ content: (await import('./screens/research_projects')).researchProjectsScreen(), activeHash: '#/me' }),
  editions: async () => ({ content: (await import('./screens/editions')).editionsScreen(), activeHash: '#/library' }),
  series: async () => ({ content: (await import('./screens/series')).seriesScreen(), activeHash: '#/library' }),
  'data-quality': async () => ({ content: (await import('./screens/data_quality')).dataQualityScreen(), activeHash: '#/library' }),
  'admin-books': async () => ({ content: (await import('./screens/admin_books')).adminBooksScreen(), activeHash: '#/library' }),
  'sign-in': async () => ({ content: (await import('./screens/sign_in')).signInScreen(), activeHash: '#/me' }),
  search: async () => ({ content: (await import('./screens/search')).searchScreen(), activeHash: '#/search' }),
  library: async () => ({ content: (await import('./screens/library')).libraryScreen(), activeHash: '#/library' }),
  authors: async () => ({ content: (await import('./screens/library')).authorsScreen(), activeHash: '#/authors' }),
  author: async route => ({ content: (await import('./screens/library')).authorBooksScreen(route.param!), activeHash: '#/authors' }),
  people: async route => ({ content: (await import('./screens/library')).peopleScreen(route.param!), activeHash: '#/authors' }),
  me: async () => ({ content: (await import('./screens/me')).meScreen(), activeHash: '#/me' }),
  settings: async () => ({ content: (await import('./screens/settings')).settingsScreen(), activeHash: '#/me' }),
  notes: async () => ({ content: (await import('./screens/notes')).notesScreen(), activeHash: '#/me' }),
}

export async function preloadRoute(route: Route): Promise<unknown> {
  // Keep route-specific CSS after the complete shared cascade, even on hover
  // preloads and direct deep links. Download-only HTML hints remain parallel.
  if(route.name!=='home')await import('./route_full_styles')
  switch (route.name) {
    case 'categories': return import('./screens/categories')
    case 'not-found': return Promise.resolve()
    case 'quotes': return import('./screens/quotes')
    case 'reader': case 'book': return import('./screens/reader')
    case 'welcome': return import('./screens/welcome')
    case 'home': return import('./screens/home')
    case 'new-books': return import('./screens/new_books')
    case 'recommendations': return import('./screens/recommendations')
    case 'features': return import('./screens/features')
    case 'browse': return import('./screens/browse')
    case 'quran': case 'quran-tafsir': return import('./screens/quran')
    case 'sunnah': case 'sunnah-source': return import('./screens/sunnah')
    case 'shelves': return import('./screens/shelves')
    case 'reading-plans': return import('./screens/reading_plans')
    case 'research-projects': return import('./screens/research_projects')
    case 'editions': return import('./screens/editions')
    case 'series': return import('./screens/series')
    case 'data-quality': return import('./screens/data_quality')
    case 'admin-books': return import('./screens/admin_books')
    case 'sign-in': return import('./screens/sign_in')
    case 'search': return import('./screens/search')
    case 'library': case 'authors': case 'author': case 'people': return import('./screens/library')
    case 'me': return import('./screens/me')
    case 'settings': return import('./screens/settings')
    case 'notes': return import('./screens/notes')
  }
}

import {prepareRouteScroll} from './navigation_scroll'
let renderGeneration = 0
let releaseRouteTitle=()=>{}
const preloadReaderWhenIdle=createReaderIdlePrewarm(
  ()=>document.visibilityState==='visible'&&readerPrewarmRouteEligible(parseLocation().name),
  ()=>import('./screens/reader'),
  warm=>{if ('requestIdleCallback' in window) window.requestIdleCallback(warm,{timeout:2500});else globalThis.setTimeout(warm,900)},
)

function finishRoute(root: HTMLElement, content: HTMLElement, activeHash: string, focusMain: boolean, warmReader = false): void {
  root.replaceChildren(activeHash === '#/welcome' ? content : appFrame(content, activeHash), globalRemembrance())
  restoreSelectedSiteLanguage()
  if (focusMain) focusRouteContent(root)
  // Keep the large reader chunk away from cold routes that do not express
  // book-reading intent (welcome, Quran, account and settings). Search also
  // reserves its cold-load budget for the index; a result click loads the reader.
  if (warmReader) preloadReaderWhenIdle()
}

async function renderReader(route: Route, root: HTMLElement, generation: number, focusMain: boolean): Promise<void> {
  // Metadata hydration may finish after navigation moved to another screen.
  // Fence before recording activity or replacing that newer screen's content.
  if (generation !== renderGeneration) return
  const bookId = route.param!
  recordBookOpened(bookId)
  const loading = h('main', { class: 'reader-route-loading reader-route-loading--instant', id: 'main-content', tabindex: -1, 'aria-label': 'قارئ الكتاب' }, readerLoadingPaper())
  root.replaceChildren(loading)
  if (focusMain) focusRouteContent(root)
  try {
    const { readerScreen } = await import('./screens/reader')
    try { markReaderChunkLoaded(sessionStorage) } catch { /* التخزين قد يكون معطلاً */ }
    if (generation !== renderGeneration || parseLocation().name !== 'reader') return
    root.replaceChildren(readerScreen(bookId), globalRemembrance())
    restoreSelectedSiteLanguage()
    releaseRouteTitle = bindPageMeta(root.firstElementChild as HTMLElement, () => generation === renderGeneration)
    if (focusMain) focusRouteContent(root)
  } catch (error) {
    if (generation !== renderGeneration) return
    try {
      if (shouldReloadReaderChunk(error, sessionStorage)) {
        loading.replaceChildren(stateView({ kind: 'loading', icon: 'book', title: 'جارٍ تحديث أدوات القارئ', description: 'يُعاد فتح الكتاب تلقائيًا بعد مطابقة ملفات النسخة الحالية.' }))
        location.reload(); return
      }
    } catch { /* لا نكرر reload إن كان تخزين الجلسة معطلاً */ }
    loading.replaceChildren(stateView({ kind: 'error', title: 'تعذّر تحميل أدوات القارئ', description: 'الكتاب لم يتغير. تحقق من الاتصال ثم أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: () => render(true) }))
  }
}

export function render(focusMain = false): void {
  releaseRouteTitle();releaseRouteTitle=()=>{}
  const generation = ++renderGeneration
  beginRouteResourceScope()
  const route = parseLocation()
  if(route.canonicalHash&&route.canonicalHash!==routeLocation.hash)history.replaceState(history.state,'',legacyHashToPath(route.canonicalHash))
  const root = document.getElementById('app')
  if (!root) return
  const finishScroll=prepareRouteScroll(routeLocation.hash,route.name==='reader')
  const titleRoute = route.name === 'quran-tafsir' ? 'quran' : route.name === 'sunnah-source' ? 'sunnah' : route.name
  setSourceDocumentTitle(routeDocumentTitle(titleRoute))
  // Author labels repaint by identity when their sparse public registry arrives;
  // a slow metadata refresh must not hold a book/category route blank.
  void hydrateAuthorDisplayNames().catch(() => undefined)
  const metadataReady=Promise.allSettled([hydrateSubjectCategories()])
  const fullStyles=route.name==='home'?Promise.resolve():import('./route_full_styles')
  const beforeRender=Promise.all([fullStyles,routeNeedsMetadataBeforeRender(route.name)?metadataReady:Promise.resolve()])
  if (route.name === 'reader' && route.param) {
    void beforeRender.then(()=>{if(generation===renderGeneration)return renderReader(route, root, generation, focusMain)}).then(()=>{if(generation===renderGeneration)finishScroll()}).catch(()=>{
      if(generation!==renderGeneration)return
      finishRoute(root,stateView({kind:'error',title:'تعذّر تحميل أدوات القارئ',description:'الكتاب لم يتغير. تحقق من الاتصال ثم أعد المحاولة.',actionLabel:'إعادة المحاولة',onAction:()=>render(true)}),'#/',focusMain)
      finishScroll()
    })
    return
  }
  const loader = routeLoaders[route.name as Exclude<Route['name'], 'reader' | 'book'>]
  void beforeRender.then(()=>loader(route)).then(({ content, activeHash }) => {
    if (generation !== renderGeneration) return
    try { markModuleLoaded(sessionStorage) } catch { /* التخزين قد يكون معطلاً */ }
    finishRoute(root, content, activeHash, focusMain, readerPrewarmRouteEligible(route.name))
    releaseRouteTitle=bindPageMeta(content,()=>generation===renderGeneration)
    finishScroll()
  }).catch(error => {
    if (generation !== renderGeneration) return
    try {
      if (shouldReloadStaleModule(error, sessionStorage)) {
        root.replaceChildren(stateView({ kind: 'loading', title: 'جارٍ تحديث الصفحة', description: 'تتم مطابقة ملفات الموقع مع أحدث إصدار منشور.' }))
        location.reload()
        return
      }
    } catch { /* لا نكرر reload إن كان تخزين الجلسة معطلاً */ }
    const errorView = stateView({ kind: 'error', title: 'تعذّر فتح الصفحة الآن', description: 'لم تتغير بياناتك. أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: () => render(true) })
    finishRoute(root, errorView, '#/', focusMain)
    finishScroll()
  })
}

// ابدأ جلب شاشة الرابط الحالي فور تقييم الموجّه؛ render يعيد استخدام cache الاستيراد نفسه.
if (typeof location !== 'undefined') void preloadRoute(location.hash.startsWith('#/')?parseHash(location.hash):parseLocation()).catch(() => undefined)



import {routeLocation,locationRouteHash,legacyHashToPath} from "./path_location"

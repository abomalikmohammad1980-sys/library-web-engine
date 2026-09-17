export type AccessibleRoute = 'home' | 'quran' | 'quran-tafsir' | 'sunnah' | 'welcome' | 'browse' | 'reader' | 'book' | 'shelves' | 'reading-plans' | 'research-projects' | 'editions' | 'series' | 'data-quality' | 'me' | 'settings' | 'notes' | 'library' | 'authors' | 'author' | 'search'

export const ACCESSIBLE_ROUTES: readonly AccessibleRoute[] = ['home', 'quran', 'quran-tafsir', 'sunnah', 'welcome', 'browse', 'reader', 'book', 'shelves', 'reading-plans', 'research-projects', 'editions', 'series', 'data-quality', 'me', 'settings', 'notes', 'library', 'authors', 'author', 'search']

const TITLES: Record<AccessibleRoute, string> = {
  home: 'الرئيسية', quran: 'القرآن', 'quran-tafsir': 'تفسير الآية', sunnah: 'السنة النبوية', welcome: 'مرحبًا بك', browse: 'اكتشف', reader: 'قراءة الكتاب', book: 'صفحة الكتاب',
  shelves: 'الرفوف الشخصية', 'reading-plans': 'خطط القراءة', 'research-projects': 'المشاريع البحثية', editions: 'مركز الطبعات', series: 'السلاسل العلمية', 'data-quality': 'جودة بيانات المكتبة', me: 'مساحتك', settings: 'الإعدادات', notes: 'العلامات والملاحظات',
  library: 'مكتبتي', authors: 'المؤلفون', author: 'رف المؤلف', search: 'البحث الموسع',
}

export function routeDocumentTitle(route: AccessibleRoute): string {
  return `${TITLES[route]} — الخِزانة`
}

export function focusRouteContent(root: ParentNode): boolean {
  const target = root.querySelector<HTMLElement>('#main-content, main, [role="main"]')
  if (!target) return false
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
  return true
}

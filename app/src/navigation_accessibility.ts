export type AccessibleRoute = 'categories' | 'recommendations' | 'not-found' | 'home' | 'quotes' | 'new-books' | 'features' | 'quran' | 'quran-tafsir' | 'sunnah' | 'welcome' | 'browse' | 'reader' | 'book' | 'shelves' | 'reading-plans' | 'research-projects' | 'editions' | 'series' | 'data-quality' | 'me' | 'settings' | 'notes' | 'library' | 'authors' | 'author' | 'people' | 'search' | 'admin-books' | 'sign-in'

export const ACCESSIBLE_ROUTES: readonly AccessibleRoute[] = ['categories', 'recommendations', 'not-found', 'home', 'quotes', 'new-books', 'features', 'quran', 'quran-tafsir', 'sunnah', 'welcome', 'browse', 'reader', 'book', 'shelves', 'reading-plans', 'research-projects', 'editions', 'series', 'data-quality', 'me', 'settings', 'notes', 'library', 'authors', 'author', 'people', 'search', 'admin-books', 'sign-in']

const TITLES: Record<AccessibleRoute, string> = {
  categories:'أقسام المكتبة',
  recommendations:'مقترح لك من خزانتك',
  'not-found':'الصفحة غير موجودة', home: 'الرئيسية', quotes: 'الاقتباسات', 'new-books': 'جديد الخِزانة', features: 'ميزات الخِزانة', quran: 'القرآن', 'quran-tafsir': 'تفسير الآية', sunnah: 'السنة النبوية', welcome: 'مرحبًا بك', browse: 'اكتشف', reader: 'قراءة الكتاب', book: 'صفحة الكتاب',
  shelves: 'الرفوف الشخصية', 'reading-plans': 'خطط القراءة', 'research-projects': 'المشاريع البحثية', editions: 'مركز الطبعات', series: 'السلاسل العلمية', 'data-quality': 'جودة بيانات المكتبة', me: 'مساحتك', settings: 'الإعدادات', notes: 'العلامات والملاحظات',
  library: 'مكتبتي', authors: 'المؤلفون', author: 'رف المؤلف', people: 'ترجمة المؤلف', search: 'البحث الشامل في الخزانة', 'admin-books': 'إدارة الكتب المنشورة', 'sign-in': 'الدخول إلى الحساب',
}

export function routeDocumentTitle(route: AccessibleRoute): string {
  return `${TITLES[route]} - الخِزانة`
}

export function focusRouteContent(root: ParentNode): boolean {
  const target = root.querySelector<HTMLElement>('#main-content, main, [role="main"]')
  if (!target) return false
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
  return true
}

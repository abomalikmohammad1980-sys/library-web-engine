import type { SearchField } from './engine/search_store'
import type { SearchMode } from './search_presentation'

export const SEARCH_PAGE_TITLE = 'البحث الشامل في الخزانة'
export const SEARCH_MODE_OPTIONS: ReadonlyArray<readonly [SearchMode, string, string]> = [
  ['exact', 'مطابقة العبارة', 'مطابقة العبارة بعد توحيد الرسم العربي'],
  ['morphological', 'الكلمة ولواصقها', 'يوحّد الرسم ويحذف اللواصق العربية الشائعة؛ أوسع من مطابقة العبارة وأضيق من البحث بالجذر'],
  ['root', 'البحث بالجذر', 'يستخرج الجذر بمحلّل الخليل، ثم يبحث في الكلمات المشتركة في الجذر ولو اختلف بناؤها'],
]

const ALL_SEARCH_FIELDS: readonly SearchField[] = ['body', 'heading', 'tag', 'card']

/**
 * «المتن» هو الاختيار الشامل في الواجهة؛ أما أي اختيار متخصص فيستبعده.
 * إبقاء هذه القاعدة دالةً نقية يمنع اختلاف الرابط المحفوظ عن مربعات الاختيار.
 */
export function visibleSearchFieldsAfterToggle(current: readonly SearchField[], changed: SearchField, checked: boolean): SearchField[] {
  const selected = new Set(current)
  checked ? selected.add(changed) : selected.delete(changed)
  if (changed === 'body' && checked) return ['body']
  if (changed !== 'body' && checked) selected.delete('body')
  return selected.size ? ALL_SEARCH_FIELDS.filter(field => selected.has(field)) : ['body']
}

/** الحقول الفعلية المرسلة للمحرك؛ المتن يتضمن جميع النطاقات الأخرى. */
export function expandedSearchFields(visible: readonly SearchField[]): SearchField[] {
  return !visible.length || visible.includes('body') ? [...ALL_SEARCH_FIELDS] : ALL_SEARCH_FIELDS.filter(field => visible.includes(field))
}

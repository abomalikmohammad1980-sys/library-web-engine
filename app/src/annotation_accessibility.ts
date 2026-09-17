import {uiLabelParameter, uiTemplateAttribute, renderBoundUiTemplate} from './ui_template_binding'

export function annotationTitleId(id: string): string {
  let hash = 2166136261
  for (const char of id) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619) }
  return `annotation-${(hash >>> 0).toString(36)}-title`
}

export function annotationActionLabel(action: 'delete' | 'download' | 'copy' | 'remembered' | 'again' | 'dueNow', kind: string, book: string, page: number): string {
  const verb = annotationActionVerb(action)
  return `${verb} ${kind} من ${book}، صفحة ${page}`
}

function annotationActionVerb(action: Parameters<typeof annotationActionLabel>[0]): string {
  return action === 'delete' ? 'حذف' : action === 'copy' ? 'نسخ موثّق' : action === 'remembered' ? 'تذكرت' : action === 'again' ? 'مراجعة قريبة' : action === 'dueNow' ? 'تقديم مراجعة اليوم' : 'تنزيل بطاقة'
}

/** kind is an owned annotation UI label; book is protected saved data. */
export function bindAnnotationAction(element: Element, action: Parameters<typeof annotationActionLabel>[0], kind: string, book: string, page: number): void {
  uiTemplateAttribute(element, 'aria-label', '2b2b04bbd233109f', {p1:uiLabelParameter(annotationActionVerb(action)),p2:uiLabelParameter(kind),p3:book,p4:page})
}

export function annotationDeletePrompt(kind: string, page: number, book?: string, language=typeof document==='undefined'?'ar':document.documentElement.lang||'ar'): string {
  if(language==='en')return book
    ?renderBoundUiTemplate('e287e3be66c2acfb',{p1:uiLabelParameter(kind),p2:book,p3:page},language)
    :renderBoundUiTemplate('74f748471b69e34f',{p1:uiLabelParameter(kind),p2:page},language)
  return `حذف ${kind}${book ? ` من «${book}»` : ''} في الصفحة ${page}؟ لا يمكن التراجع عن هذا الحذف.`
}

import { pageContent } from '../components'
import { listBooks } from '../engine/library_store'
import { auditLibraryData, type QualityIssueKind } from '../library_data_quality'
import { mountStateView, stateView } from '../state_view'
import { arabicNum, h } from '../ui'

export function dataQualityScreen(): HTMLElement {
  const root = pageContent(h('section', { class: 'quality-hero', 'aria-labelledby': 'quality-title' }, h('p', { class: 'page-eyebrow' }, 'إدارة وتوثيق'), h('h1', { class: 'page-title', id: 'quality-title' }, 'جودة بيانات المكتبة'), h('p', { class: 'page-sub' }, 'تدقيق محلي صريح للنواقص والتعارضات التي تؤثر في البحث والطبعات والسلاسل.')))
  const host = stateView({ kind: 'loading', icon: 'settings', title: 'جارٍ تدقيق بيانات الكتب' }); root.appendChild(host); void hydrate(host); return root
}
async function hydrate(host: HTMLElement): Promise<void> {
  try {
    const issues = auditLibraryData(await listBooks()), filter = h('select', { 'aria-label': 'تصفية نوع مشكلة البيانات' }, h('option', { value: '' }, 'كل المشكلات'), h('option', { value: 'identity' }, 'هوية المؤلف'), h('option', { value: 'classification' }, 'التصنيف'), h('option', { value: 'edition' }, 'الطبعات'), h('option', { value: 'series' }, 'السلاسل')) as HTMLSelectElement
    const summary = h('strong', { 'aria-live': 'polite' }), list = h('div', { class: 'quality-issues' })
    const render = (): void => { const active = filter.value as QualityIssueKind | '', shown = active ? issues.filter(issue => issue.kind === active) : issues; summary.textContent = `${arabicNum(shown.length)} ملاحظة بيانات`; list.replaceChildren(); if (!shown.length) { list.appendChild(stateView({ kind: 'empty', icon: 'check', title: active ? 'لا توجد مشكلات من هذا النوع' : 'بيانات المكتبة تجتاز التدقيق الحالي', compact: true })); return } for (const issue of shown) list.appendChild(h('article', { class: `quality-issue quality-issue--${issue.severity}` }, h('div', null, h('strong', null, issue.bookTitle), h('p', null, issue.message)), h('div', { class: 'quality-issue__actions' }, h('a', { class: 'btn btn--secondary', href: `#/reader/${issue.bookId}` }, 'قراءة الكتاب'), h('a', { class: 'btn btn--primary', href: `#/library?adminQ=${encodeURIComponent(issue.bookTitle)}` }, 'إصلاح في الإدارة')))) }
    filter.addEventListener('change', render); host.className = 'quality-workspace'; host.removeAttribute('role'); host.replaceChildren(h('div', { class: 'quality-controls' }, filter, summary), list); render()
  } catch { mountStateView(host, { kind: 'error', title: 'تعذّر تدقيق بيانات المكتبة', description: 'لم تتغير أي بيانات.', actionLabel: 'إعادة المحاولة', onAction: () => void hydrate(host) }) }
}

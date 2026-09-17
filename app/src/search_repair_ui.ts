import {h} from './ui'
import {uiTemplateText} from './ui_template_binding'
import type {RepairFailure, RepairProgress} from './search_index_repair'

/** Labels are owned UI; titles and arbitrary failure details remain protected text. */
export function searchRepairProgress(value: RepairProgress): HTMLElement {
  return h('span', null, uiTemplateText('search-repair-progress', {p1: value.completed, p2: value.total}), h('span', {dataset: {noTranslate: ''}}, value.title))
}

export function searchRepairReport(failures: readonly RepairFailure[], catalogIds: ReadonlySet<string>): HTMLElement {
  const report = h('details', null, h('summary', null, failures.length ? uiTemplateText('search-repair-failures', {p1: failures.length}) : 'أُعيد البحث بعد تهيئة الكتب'))
  for (const failure of failures) {
    const missing = !catalogIds.has(failure.id) && failure.reason === 'لم يتوفر سجل الكتاب؛ أعد تحميل الكتالوج.'
    const ownedReason = missing || failure.reason === 'تعذّرت تهيئة الكتاب.'
    report.append(h('p', null,
      h('span', missing ? null : {dataset: {noTranslate: ''}}, missing ? 'كتاب لم يتوفر اسمه في الكتالوج' : failure.title),
      ': ', h('span', ownedReason ? null : {dataset: {noTranslate: ''}}, failure.reason)))
  }
  return report
}

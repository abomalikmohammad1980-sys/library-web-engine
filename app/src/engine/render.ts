/*
 * تحويل الفقرة إلى DOM — المرحلة 1. يفصل DOM عن منطق الجسر (bridge.ts) كي
 * يُختبر الأخير في node بلا متصفّح. النصّ يُبنى بعقدِ DOM (لا innerHTML).
 */

import type { BodyParagraph, EffectiveRun } from '@engine/ooxml-model'
import { h } from '../ui'

const TWIPS_PER_PX = 20 / 96

function px(twips: number): number {
  return twips * TWIPS_PER_PX
}

/** يبني عنصرَ p للفقرة مع تنسيقاتها: محاذاة، مسافات بادئة، اتجاه، ثم الرنّات. */
export function paragraphToDom(p: BodyParagraph): HTMLElement {
  const pEl = h('p', { class: 'reading__para' })

  const styles: string[] = []
  if (p.jc === 'center') styles.push('text-align: center')
  else if (p.jc === 'right') styles.push('text-align: right')
  else if (p.jc === 'left') styles.push('text-align: left')
  else if (p.jc === 'both') styles.push('text-align: justify')
  else styles.push('text-align: justify')

  if (p.bidi) styles.push('direction: rtl')
  if (p.indFirstLine) styles.push(`text-indent: ${px(p.indFirstLine).toFixed(1)}px`)
  if (p.indLeft) styles.push(`margin-inline-start: ${px(p.indLeft).toFixed(1)}px`)
  if (p.indRight) styles.push(`margin-inline-end: ${px(p.indRight).toFixed(1)}px`)

  if (styles.length) pEl.setAttribute('style', styles.join('; '))

  for (const run of p.runs) {
    if (run.hidden || !run.text) continue
    appendRun(pEl, run)
  }
  return pEl
}

/** أسماء خطوط OOXML ⟵ أسماء عائلات CSS شائعة (العائلة المُحلَّلة في النموذج). */
function cssFontFamily(family: string | null): string {
  if (!family) return 'var(--font-reading)'
  const f = family.toLowerCase()
  if (f.includes('traditional arabic')) return 'Traditional Arabic, "Simplified Arabic", serif'
  if (f.includes('simple indust')) return '"Simple Indust Shaded", "Traditional Arabic", serif'
  if (f.includes('amiri')) return 'Amiri, serif'
  if (f.includes('sakkal')) return 'Sakkal Majalla, serif'
  if (f.includes('arabic typesetting')) return '"Arabic Typesetting", serif'
  if (f.includes('andalus')) return 'Andalus, serif'
  return `${family}, serif`
}

/** يُلحق رنًّا واحدًا بالنصّ النهائيّ — النصّ مباشرةً في DOM بلا innerHTML. */
function appendRun(parent: HTMLElement, run: EffectiveRun): void {
  const node = run.bold || run.italic || run.underline || run.color || run.emTwips || run.family
    ? document.createElement('span')
    : null
  if (!node) {
    parent.appendChild(document.createTextNode(run.text))
    return
  }
  const styles: string[] = []
  if (run.family) styles.push(`font-family: ${cssFontFamily(run.family)}`)
  if (run.emTwips) styles.push(`font-size: ${px(run.emTwips).toFixed(1)}px`)
  if (run.bold) node.style.fontWeight = '700'
  if (run.italic) node.style.fontStyle = 'italic'
  if (run.underline && run.underline !== 'none') node.style.textDecoration = 'underline'
  if (run.color) node.style.color = `#${run.color}`
  if (styles.length) node.setAttribute('style', styles.join('; '))
  node.appendChild(document.createTextNode(run.text))
  parent.appendChild(node)
}

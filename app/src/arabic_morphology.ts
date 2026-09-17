import { deriveSearchTerm, normalizeArabic, type SearchMode } from './search_presentation'
import {parseAdvancedSearchQuery} from '../../packages/search/src/index'

export interface MorphologyWord {
  word: string
  lemmas: string[]
  stems: string[]
  roots: string[]
}

let worker: Worker | undefined
let nextId = 0
const pending = new Map<number, { resolve: (value: MorphologyWord[]) => void; reject: (error: Error) => void; timeout: number }>()

function morphologyWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./arabic_morphology_worker.ts', import.meta.url), { type: 'module', name: 'alkhalil-morphology' })
  worker.addEventListener('message', event => {
    const message = event.data as { id: number; analyses?: MorphologyWord[]; error?: string }
    const task = pending.get(message.id)
    if (!task) return
    pending.delete(message.id); window.clearTimeout(task.timeout)
    if (message.error) task.reject(new Error(message.error))
    else task.resolve(message.analyses ?? [])
  })
  worker.addEventListener('error', event => {
    for (const task of pending.values()) { window.clearTimeout(task.timeout); task.reject(new Error(event.message || 'alkhalil_worker_failed')) }
    pending.clear(); worker?.terminate(); worker = undefined
  })
  return worker
}

export function analyzeArabicQuery(query: string): Promise<MorphologyWord[]> {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => { pending.delete(id); reject(new Error('alkhalil_timeout')) }, 3_000)
    pending.set(id, { resolve, reject, timeout })
    morphologyWorker().postMessage({ id, query: query.slice(0, 256) })
  })
}

/** يختار اللمّة/الجذر الأعلى ترجيحًا من محلل الخليل لكل كلمة في العبارة. */
export async function deriveAnalyzedSearchTerm(query: string, mode: SearchMode): Promise<string> {
  if(mode==='exact')return query.trim()
  const expression=parseAdvancedSearchQuery(query),positive=await derivePositiveSearchTerm(expression.query,mode)
  return [positive,...expression.excluded.map(value=>`-"${value.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`)].filter(Boolean).join(' ')
}
async function derivePositiveSearchTerm(query:string,mode:SearchMode):Promise<string>{
  if (mode === 'exact') return query.trim()
  // نمط التوسيع معلن بحدوده: تطبيع لواصق محلي حتمي، لا ادعاء تحليل صرفي.
  if (mode === 'morphological') return deriveSearchTerm(query, mode)
  let rows: MorphologyWord[]
  try { rows = await analyzeArabicQuery(query) }
  catch { return query.trim().slice(0, 256) }
  const terms = rows.map(row => {
    const candidates = row.roots
    return candidates.map(normalizeArabic).find(value => value.length >= 2) ?? normalizeArabic(row.word)
  }).filter(Boolean)
  return terms.join(' ') || query.trim()
}

/// <reference lib="webworker" />

import { gunzipSync, strFromU8 } from 'fflate'
import { Analyzer, hasRawText, layer1DataFiles, provideRawText, type Analysis } from 'farahidi'
import { rankMorphologicalAnalyses } from './arabic_morphology_rank'

interface AnalyzeRequest { id: number; query: string }
interface WordAnalysis {
  word: string
  lemmas: string[]
  stems: string[]
  roots: string[]
}

let analyzerPromise: Promise<Analyzer> | undefined

async function loadAnalyzer(): Promise<Analyzer> {
  if (analyzerPromise) return analyzerPromise
  analyzerPromise = (async () => {
    const files = layer1DataFiles()
    await Promise.all(files.map(async file => {
      if (hasRawText(file)) return
      const response = await fetch(`/morphology/alkhalil/${encodeURIComponent(file)}`, { cache: 'force-cache' })
      if (!response.ok) throw new Error(`alkhalil_table_http_${response.status}`)
      provideRawText(file, strFromU8(gunzipSync(new Uint8Array(await response.arrayBuffer()))))
    }))
    return new Analyzer()
  })().catch(error => { analyzerPromise = undefined; throw error })
  return analyzerPromise
}

function distinct(values: string[], limit = 8): string[] {
  return [...new Set(values.map(value => value.trim()).filter(value => value && value !== '-' && value !== '#'))].slice(0, limit)
}

function summarize(word: string, rows: Analysis[]): WordAnalysis {
  const ranked = rankMorphologicalAnalyses(rows)
  return {
    word,
    lemmas: distinct(ranked.map(row => row.lemma)),
    stems: distinct(ranked.map(row => row.stem)),
    roots: distinct(ranked.map(row => row.root), 4),
  }
}

self.addEventListener('message', event => {
  const request = event.data as AnalyzeRequest
  void loadAnalyzer().then(analyzer => {
    const words = (request.query.slice(0, 256).match(/[\p{Script=Arabic}\u064B-\u065F\u0670]+/gu) ?? []).slice(0, 12)
    const analyses = words.map(word => summarize(word, analyzer.analyze(word)))
    self.postMessage({ id: request.id, analyses })
  }).catch(error => self.postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) }))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost } from '../functions/api/translate.js'

const request = () => new Request('https://library.example/api/translate', {
  method: 'POST', headers: { origin: 'https://library.example', 'content-type': 'application/json' },
  body: JSON.stringify({ text: 'مرحبا', targetLanguage: 'en' }),
})
function usageDb() {
  const cache = new Map(), metrics = new Map()
  return { cache, metrics, prepare(sql) {
    let args = []
    return {
      bind(...values) { args = values; return this },
      async first() {
        if (sql.includes('translation_response_cache')) { const row = cache.get(args[0]); return row && row.expires_at > args[1] ? row : null }
        return { attempts: 1 }
      },
      async run() {
        if (sql.includes('translation_usage_metrics')) {
          const [period, provider, requests, characters, succeeded, failed, cacheHits, cacheCharactersSaved] = args
          const key = `${period}:${provider}`, row = metrics.get(key) || { requests: 0, characters: 0, succeeded: 0, failed: 0, cache_hits: 0, cache_characters_saved: 0 }
          Object.assign(row, { requests: row.requests + requests, characters: row.characters + characters, succeeded: row.succeeded + succeeded, failed: row.failed + failed, cache_hits: row.cache_hits + cacheHits, cache_characters_saved: row.cache_characters_saved + cacheCharactersSaved })
          metrics.set(key, row)
        } else if (sql.includes('INSERT INTO translation_response_cache')) {
          const [key, translation, provider, created, expires] = args
          cache.set(key, { translation, provider, created_at: created, expires_at: expires })
        }
      },
    }
  } }
}
const db = usageDb()

test('disabled router preserves the original Workers AI result and fallback', async () => {
  const calls = []
  const response = await onRequestPost({ request: request(), env: { VISITORS_DB: db, AI: { async run(model) {
    calls.push(model)
    if (model.includes('m2m100')) throw Error('model unavailable')
    return { response: 'hello' }
  } } } })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).engine, 'multilingual-fallback')
  assert.equal(calls.length, 2)
})

test('enabled router falls back to Workers AI if quota storage is unavailable', async () => {
  const response = await onRequestPost({ request: request(), env: { VISITORS_DB: db, TRANSLATION_ROUTER_ENABLED: '1', AI: { async run() { return { translated_text: 'hello' } } } } })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).engine, 'm2m100')
})

test('enabled route records Workers AI usage and serves a later request from cache', async () => {
  const database = usageDb(), calls = []
  const env = { VISITORS_DB: database, TRANSLATION_ROUTER_ENABLED: '1', AI: { async run(model) { calls.push(model); return { translated_text: 'hello from workers ai' } } } }
  const first = await onRequestPost({ request: request(), env })
  const second = await onRequestPost({ request: request(), env })
  assert.equal((await first.json()).engine, 'm2m100')
  assert.equal((await second.json()).engine, 'cache')
  assert.deepEqual(calls, ['@cf/meta/m2m100-1.2b'])
  assert.equal(database.metrics.get(`${new Date().toISOString().slice(0, 7)}:workers-ai-m2m100`).succeeded, 1)
  assert.equal(database.metrics.get(`${new Date().toISOString().slice(0, 7)}:cache`).cache_hits, 1)
})


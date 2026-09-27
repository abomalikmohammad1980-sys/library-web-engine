import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestGet, readTranslationUsage } from '../functions/api/admin/translation-usage.js'
import { onRequestGet as pageGet } from '../functions/api/admin/translation-dashboard.js'

test('usage report joins free quota, provider activity, and cache savings', async () => {
  const env = { TRANSLATION_ROUTER_ENABLED: '1', AZURE_TRANSLATOR_KEY: 'present', TRANSLATION_AZURE_FREE_CHARS: '1000' }
  const db = { prepare(sql) { return { bind(...args) { this.args = args; return this }, async all() {
    if (sql.includes('translation_provider_usage')) return { results: [{ bucket: 'azure:2026-09', used: 300 }] }
    if (sql.includes('translation_usage_metrics')) return { results: [
      { provider: 'azure', requests: 4, characters: 300, succeeded: 3, failed: 1 },
      { provider: 'workers-ai-m2m100', requests: 2, characters: 80, succeeded: 2, failed: 0 },
      { provider: 'cache', cache_hits: 7, cache_characters_saved: 420 },
    ] }
    return { results: [] }
  } } } }
  const report = await readTranslationUsage(env, db, new Date('2026-09-27T10:00:00Z'))
  const azure = report.providers.find(row => row.provider === 'azure')
  assert.equal(report.period, '2026-09')
  assert.equal(report.routerEnabled, true)
  assert.equal(azure.used, 300)
  assert.equal(azure.limit, 1000)
  assert.equal(azure.remaining, 700)
  assert.equal(azure.requests, 4)
  assert.equal(azure.succeeded, 3)
  assert.equal(report.cache.hits, 7)
  assert.equal(report.cache.charactersSaved, 420)
  const workersAi = report.providers.find(row => row.provider === 'workers-ai-m2m100')
  assert.equal(workersAi.requests, 2)
  assert.equal(workersAi.characters, 80)
  assert.equal(workersAi.limit, null)
})

test('usage API is restricted to managers', async () => {
  const response = await onRequestGet({ request: new Request('https://example.test/api/admin/translation-usage'), env: {} })
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error, 'admin_required')
})

test('dashboard page does not render for unauthenticated visitors', async () => {
  const response = await pageGet({ request: new Request('https://example.test/admin/translation-usage'), env: {} })
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error, 'admin_required')
})


import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost } from '../functions/api/translate.js'

const request = () => new Request('https://library.example/api/translate', {
  method: 'POST', headers: { origin: 'https://library.example', 'content-type': 'application/json' },
  body: JSON.stringify({ text: 'مرحبا', targetLanguage: 'en' }),
})
const db = { prepare() { return { bind() { return this }, async first() { return { attempts: 1 } }, async run() {} } } }

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

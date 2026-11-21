import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { LocalQueueStore } from '../src/local-queue.mjs'
import { HY_MT_LANGUAGES, validateLocalTranslation } from '../src/local-policy.mjs'

function database() {
  const db = new DatabaseSync(':memory:')
  return { exec(query, ...args) {
    const statement = db.prepare(query)
    const rows = statement.columns().length ? statement.all(...args) : (statement.run(...args), [])
    return { toArray: () => rows }
  } }
}
const payload = { id: 'a'.repeat(64), text: 'فتح الباري', target: 'en', purpose: 'text', sourceType: 'title' }
test('language intersection is exactly 22; excluded languages remain excluded', () => {
  assert.equal(Object.keys(HY_MT_LANGUAGES).length, 22)
  for (const code of ['ckb','ku','sw','hu','ps','so','ha','sv','no','ro','bs','sq','az','uz']) assert(!HY_MT_LANGUAGES[code])
})
test('persistent lease survives restart; duplicate enqueue and old result cannot advance progress', () => {
  const sql = database()
  let store = new LocalQueueStore(sql)
  store.enqueue(payload, 1000); store.enqueue(payload, 1000)
  const first = store.claim(1001)
  assert(first); assert.equal(store.claim(1002), null)
  store = new LocalQueueStore(sql)
  assert.equal(store.claim(1003), null)
  const second = store.claim(200000)
  assert.notEqual(second.token, first.token)
  assert.throws(() => store.requireLease(payload.id, first.token, 200001), /lease/)
  store.finish(payload.id, second.token, 200001)
  store.finish(payload.id, second.token, 200002)
  assert.equal(store.status(200003).completed, 1)
  assert.equal(store.claim(200004), null)
})
test('failure changes to the existing fallback route and bounded retries become failed', () => {
  const store = new LocalQueueStore(database())
  store.enqueue(payload, 1000)
  let job = store.claim(1001)
  store.fallback(job.id, job.token, 'validation_failed', 1002)
  assert.equal(store.get(job.id).mode, 'fallback')
  store.retryLater(job.id, job.token, 1003)
  for (let i=1; i<=3; i++) {
    job = store.claim(1000000*i)
    assert.equal(job.mode, 'fallback')
    store.retryLater(job.id, job.token, 1000000*i+1)
  }
  assert.equal(store.status(4000000).failed, 1)
  assert.equal(store.status(4000000).failedItems[0].id, payload.id)
  assert.equal(store.claim(4000000), null)
  store.retryFailed(payload.id, 4000001)
  assert.equal(store.claim(4000002).mode, 'fallback')
})
test('validation rejects corruption, truncation, missing numbers, explanations and repetition', () => {
  assert.equal(validateLocalTranslation('المجلد ١٢', 'Volume 12', 'en'), null)
  for (const output of ['', '???', '\uFFFD', 'Translation: Volume 12', 'Volume', 'word '.repeat(30)]) {
    assert(validateLocalTranslation('المجلد ١٢', output, 'en'), output)
  }
  assert(validateLocalTranslation('نص عربي', 'Arabic text', 'en', 'length'))
  assert.equal(validateLocalTranslation('الكتاب {p0}', 'Book {x0}', 'en'), 'placeholders_changed')
  assert.equal(validateLocalTranslation('الكتاب {p0}', 'Book {p0}', 'en'), null)
})

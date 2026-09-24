import test from 'node:test'
import assert from 'node:assert/strict'
import { LANGUAGE_ROUTES, routeTranslation, reserveQuota } from '../functions/api/_translation-router.js'

function db() {
  const counters = new Map()
  return {
    counters,
    prepare(sql) {
      let args
      return {
        bind(...values) { args = values; return this },
        async first() {
          const [key, amount, limit] = args
          const used = counters.get(key) || 0
          if (used + amount > limit) return null
          counters.set(key, used + amount)
          return { used: used + amount }
        },
        async run() { return { success: true } },
      }
    },
  }
}

const configured = { AZURE_TRANSLATOR_KEY: 'test', GOOGLE_TRANSLATE_KEY: 'test', QWEN_API_KEY: 'test', QWEN_ENDPOINT: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions' }

test('36 routes and Kurdish dialect mapping remain distinct', () => {
  assert.equal(Object.keys(LANGUAGE_ROUTES).length, 36)
  assert.equal(LANGUAGE_ROUTES.ckb.codes.azure, 'ku')
  assert.equal(LANGUAGE_ROUTES.ku.codes.azure, 'kmr')
  assert.equal(LANGUAGE_ROUTES.no.codes.azure, 'nb')
  assert.equal(LANGUAGE_ROUTES.zh.codes.azure, 'zh-Hans')
  assert.equal(LANGUAGE_ROUTES.no.codes.qwen, 'nb')
  assert.ok(!LANGUAGE_ROUTES.ug.priority.includes('qwen'))
  assert.ok(!LANGUAGE_ROUTES.ckb.priority.includes('aws'))
})

test('atomic reservation stops at cap and isolates periods', async () => {
  const database = db()
  assert.equal(await reserveQuota(database, 'azure', '2026-09', 6, 10), true)
  assert.equal(await reserveQuota(database, 'azure', '2026-09', 5, 10), false)
  assert.equal(await reserveQuota(database, 'azure', '2026-10', 5, 10), true)
})

test('routes to next configured provider when first free cap is exhausted', async () => {
  const database = db()
  const calls = []
  const result = await routeTranslation({ env: { ...configured, VISITORS_DB: database }, text: 'سلام', target: 'en', purpose: 'text', now: new Date('2026-09-24'), adapters: {
    qwen: async () => { calls.push('qwen'); return 'hello from qwen' },
    azure: async () => { calls.push('azure'); return 'hello from azure' },
    google: async () => { calls.push('google'); return 'hello from google' },
  } })
  assert.equal(result.translation, 'hello from azure')
  assert.deepEqual(calls, ['azure'])
  const again = await routeTranslation({ env: { ...configured, VISITORS_DB: database, TRANSLATION_AZURE_FREE_CHARS: '0' }, text: 'سلام', target: 'en', purpose: 'text', now: new Date('2026-09-24'), adapters: {
    azure: async () => { calls.push('azure2'); throw Error('should not call') },
    google: async () => { calls.push('google'); return 'hello from google' },
  } })
  assert.equal(again.provider, 'google')
})

test('provider failure continues and failed reservation is retained conservatively', async () => {
  const database = db()
  const result = await routeTranslation({ env: { ...configured, VISITORS_DB: database }, text: 'سلام', target: 'en', purpose: 'text', now: new Date('2026-09-24'), adapters: {
    azure: async () => { throw Error('429 quota') },
    google: async () => 'hello',
  } })
  assert.equal(result.provider, 'google')
  assert.ok([...database.counters.values()].some(x => x > 0))
})

test('first reservation cannot exceed the limit', async () => {
  const database = db()
  assert.equal(await reserveQuota(database, 'azure', '2026-09', 11, 10), false)
  assert.equal(database.counters.size, 0)
})

test('Alibaba Content-MD5 matches RFC test vector', async () => {
  const { contentMd5 } = await import('../functions/api/_translation-alibaba.js')
  assert.equal(contentMd5('abc'), 'kAFQmDzST7DWlj99KOF/cg==')
})

test('trial expiry excludes Qwen and AWS even when credentials exist', async () => {
  const database = db()
  const called = []
  await assert.rejects(routeTranslation({ env: { VISITORS_DB: database, QWEN_API_KEY: 'test', QWEN_ENDPOINT: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', AWS_TRANSLATE_ACCESS_KEY_ID: 'test', AWS_TRANSLATE_SECRET_ACCESS_KEY: 'test', AWS_TRANSLATE_REGION: 'us-east-1' }, text: 'سلام', target: 'en', purpose: 'text', now: new Date('2026-09-24'), adapters: { qwen: async () => { called.push('qwen') }, aws: async () => { called.push('aws') } } }))
  assert.deepEqual(called, [])
})

test('provider adapters send Arabic and mapped target without logging secrets', async () => {
  const { PROVIDERS } = await import('../functions/api/_translation-router.js')
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return Response.json(url.includes('microsofttranslator') ? [{ translations: [{ text: 'Hallo' }] }] : { data: { translations: [{ translatedText: 'Hallo' }] } })
  }
  try {
    assert.equal(await PROVIDERS.azure({ env: { AZURE_TRANSLATOR_KEY: 'secret' }, text: 'مرحبا', target: 'de' }), 'Hallo')
    assert.equal(await PROVIDERS.google({ env: { GOOGLE_TRANSLATE_KEY: 'secret' }, text: 'مرحبا', target: 'de' }), 'Hallo')
    assert.equal(new URL(calls[0].url).searchParams.get('to'), 'de')
    assert.equal(JSON.parse(calls[1].init.body).source, 'ar')
    assert.equal(JSON.parse(calls[1].init.body).format, 'text')
  } finally { globalThis.fetch = original }
})

test('Alibaba adapter signs its actual JSON body and validates response', async () => {
  const { translateAlibaba, contentMd5 } = await import('../functions/api/_translation-alibaba.js')
  const original = globalThis.fetch
  let captured
  globalThis.fetch = async (url, init) => { captured = { url, init }; return Response.json({ Code: 200, Data: { Translated: 'Hello' } }) }
  try {
    assert.equal(await translateAlibaba({ env: { ALIBABA_TRANSLATE_ACCESS_KEY_ID: 'id', ALIBABA_TRANSLATE_ACCESS_KEY_SECRET: 'secret' }, text: 'سلام', target: 'en' }), 'Hello')
    assert.equal(captured.init.headers['content-md5'], contentMd5(captured.init.body))
    assert.ok(captured.init.headers.authorization.startsWith('acs id:'))
    assert.equal(JSON.parse(captured.init.body).SourceLanguage, 'ar')
  } finally { globalThis.fetch = original }
})

test('Content-MD5 signs UTF-8 Arabic bytes rather than UTF-16 code units', async () => {
  const { contentMd5 } = await import('../functions/api/_translation-alibaba.js')
  const { createHash } = await import('node:crypto')
  assert.equal(contentMd5('مرحبا'), createHash('md5').update('مرحبا', 'utf8').digest('base64'))
})

test('AWS adapter sends signed TranslateText request', async () => {
  const { PROVIDERS } = await import('../functions/api/_translation-router.js')
  const original = globalThis.fetch
  let captured
  globalThis.fetch = async (url, init) => { captured = { url, init }; return Response.json({ TranslatedText: 'Hello' }) }
  try {
    assert.equal(await PROVIDERS.aws({ env: { AWS_TRANSLATE_ACCESS_KEY_ID: 'id', AWS_TRANSLATE_SECRET_ACCESS_KEY: 'secret', AWS_TRANSLATE_REGION: 'us-east-1' }, text: 'سلام', target: 'en' }), 'Hello')
    assert.equal(captured.init.headers['x-amz-target'], 'AWSShineFrontendService_20170701.TranslateText')
    assert.ok(captured.init.headers.authorization.includes('Credential=id/'))
    assert.equal(JSON.parse(captured.init.body).SourceLanguageCode, 'ar')
  } finally { globalThis.fetch = original }
})

test('Qwen-MT Plus adapter sends a single source-labelled message', async () => {
  const { PROVIDERS } = await import('../functions/api/_translation-router.js')
  const original = globalThis.fetch
  let captured
  globalThis.fetch = async (url, init) => { captured = { url, init }; return Response.json({ choices: [{ message: { content: 'Hello' } }] }) }
  try {
    assert.equal(await PROVIDERS.qwen({ env: { QWEN_API_KEY: 'test', QWEN_ENDPOINT: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions' }, text: 'سلام', target: 'en' }), 'Hello')
    const body = JSON.parse(captured.init.body)
    assert.equal(body.model, 'qwen-mt-plus')
    assert.equal(body.translation_options.source_lang, 'ar')
    assert.equal(body.messages.length, 1)
  } finally { globalThis.fetch = original }
})

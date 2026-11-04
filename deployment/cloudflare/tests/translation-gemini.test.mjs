import test from 'node:test'
import assert from 'node:assert/strict'
import { countGeminiInputTokens, geminiSystemInstruction, maxOutputTokensFor, translateGemini } from '../functions/api/_translation-gemini.js'

test('Gemini counting and generation use the same Arabic prompt and target instruction', async () => {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(init.body) })
    if (String(url).endsWith(':countTokens')) return Response.json({ totalTokens: 184 })
    return Response.json({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Search the relevant sources.' }] } }],
      usageMetadata: { totalTokenCount: 193 },
    })
  }
  try {
    const args = { env: { GEMINI_API_KEY: 'secret-value' }, text: 'ابحث في مظان المسائل', target: 'en', purpose: 'ui' }
    assert.equal(await countGeminiInputTokens(args), 184)
    const result = await translateGemini({ ...args, maxOutputTokens: 128 })
    assert.deepEqual(result, { translation: 'Search the relevant sources.', totalTokens: 193 })
    assert.equal(calls.length, 2)
    assert.ok(calls.every(call => call.url.startsWith('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:')))
    assert.ok(calls.every(call => !call.url.includes('secret-value')))
    assert.ok(calls.every(call => call.init.headers['x-goog-api-key'] === 'secret-value'))
    assert.equal(calls[0].body.generateContentRequest.contents[0].parts[0].text, args.text)
    assert.equal(calls[0].body.generateContentRequest.systemInstruction.parts[0].text, geminiSystemInstruction('en', 'ui'))
    assert.equal(calls[1].body.generationConfig.maxOutputTokens, 128)
  } finally { globalThis.fetch = original }
})

test('Gemini adapter rejects missing usage and truncated output', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => Response.json({
    candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'partial' }] } }],
    usageMetadata: { totalTokenCount: 99 },
  })
  try {
    await assert.rejects(translateGemini({ env: { GEMINI_API_KEY: 'test' }, text: 'سلام', target: 'en', purpose: 'text', maxOutputTokens: 64 }), /gemini_output_truncated/)
  } finally { globalThis.fetch = original }
})

test('Gemini output budget is bounded and scales with the source length', () => {
  assert.equal(maxOutputTokensFor('سلام'), 64)
  assert.equal(maxOutputTokensFor('a'.repeat(100)), 200)
  assert.equal(maxOutputTokensFor('a'.repeat(6000)), 4096)
})

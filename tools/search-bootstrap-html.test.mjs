import { test } from 'node:test'
import assert from 'node:assert/strict'
import { injectSearchBootstrap } from './search-bootstrap-html.mjs'
test('overlaps fetching without moving bootstrap execution after the application', () => {
  const result = injectSearchBootstrap('<head><script type="module" crossorigin src="/assets/main.js"></script></head>')
  assert(result.includes('<script defer src="/data/shamela-search-v2-packed.js"></script>'))
  assert(result.indexOf('shamela-search') < result.indexOf('type="module"'))
  assert(!result.includes('async'))
})
test('rejects async app execution and duplicate insertion; preserves historical mode', () => {
  assert.throws(() => injectSearchBootstrap('<script type="module" async src="/app.js">'))
  const html = '<script type="module" src="/app.js">'
  assert.throws(() => injectSearchBootstrap(injectSearchBootstrap(html)))
  assert(!injectSearchBootstrap(html, { defer: false }).includes(' defer'))
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scopeStaticCacheHeaders } from './static-cache-headers.mjs'
test('does not inherit no-cache for assets while retaining mutable data and security', () => {
  const input = '/*\n  X-Content-Type-Options: nosniff\n  Cache-Control: no-cache\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n'
  const output = scopeStaticCacheHeaders(input, ['assets/main-hash.js', 'assets/fonts/hash.ttf', 'data/index.json', 'sw.js', '_headers'])
  assert(!output.split('\n\n')[0].includes('Cache-Control'))
  assert(output.includes('X-Content-Type-Options: nosniff'))
  assert(output.includes('/assets/*\n  Cache-Control: public, max-age=31536000, immutable'))
  assert(output.includes('/data/*\n  Cache-Control: no-cache'))
  assert(output.includes('/sw.js\n  Cache-Control: no-cache'))
  assert(!output.includes('/assets/*\n  Cache-Control: no-cache'))
})

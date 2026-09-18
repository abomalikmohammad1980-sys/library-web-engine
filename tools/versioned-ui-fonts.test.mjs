import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cacheableUiFont, hashedFontPath, versionedUiFonts } from './versioned-ui-fonts.mjs'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
test('only reviewed interface fonts qualify, never mutable data or other paths', () => {
  assert(cacheableUiFont('/fonts/thmanyah/thmanyahsans-Regular.woff2'))
  assert(cacheableUiFont('/fonts/hafs-uthmani.ttf'))
  for (const path of ['/data/index.json', '/fonts/../secret.woff2', '/fonts/word-user-font.ttf']) assert.equal(cacheableUiFont(path), false)
})
test('rewrites CSS before hashing, emits exact bytes once and keeps legacy redirects', async () => {
  const root = fileURLToPath(new URL('../app/public/', import.meta.url))
  const plugin = versionedUiFonts(root), emitted = []
  const context = { emitFile: row => { emitted.push(row); return row.fileName } }
  const path = '/fonts/hafs-uthmani.ttf'
  const bytes = await readFile(new URL('../app/public/fonts/hafs-uthmani.ttf', import.meta.url))
  const target = hashedFontPath(path, bytes)
  const css = `@font-face{src:url('${path}')} .other{background:url('/data/keep.json')}`
  const transformed = await plugin.transform.call(context, css, '/src/styles/tokens.css')
  assert(transformed.code.includes(`/${target}`))
  assert(transformed.code.includes("url('/data/keep.json')"))
  await plugin.transform.call(context, css, '/src/styles/other.css')
  assert.equal(emitted.length, 1)
  assert(Buffer.from(emitted[0].source).equals(bytes))
  await plugin.generateBundle.call(context)
  const redirects = emitted.find(row => row.fileName === '_redirects').source
  assert(redirects.includes('https://www.khzanah.com/* https://khzanah.com/:splat 301'))
  assert(redirects.includes(`${path} /${target} 301`))
})
test('identical font bytes keep their immutable address and changed bytes invalidate it', () => {
  const path = '/fonts/hafs-uthmani.ttf'
  assert.equal(hashedFontPath(path, Buffer.from('a')), hashedFontPath(path, Buffer.from('a')))
  assert.notEqual(hashedFontPath(path, Buffer.from('a')), hashedFontPath(path, Buffer.from('b')))
  assert.match(hashedFontPath(path, Buffer.from('a')), /^assets\/fonts\/[a-f0-9]{20}-hafs-uthmani\.ttf$/)
})

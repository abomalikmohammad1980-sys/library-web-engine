import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

test('legacy font requests use the fingerprinted offline entry without the network', async () => {
  const source = (await readFile(new URL('../app/public/sw.js', import.meta.url), 'utf8')).replace('const FONT_ALIASES = {}', 'const FONT_ALIASES = {"/fonts/hafs-uthmani.ttf":"/assets/fonts/verified-hafs.ttf"}')
  const handlers = {}, requested = [], font = new Response('font', { headers: { 'content-type': 'font/ttf' } })
  vm.runInNewContext(source, {
    self: { location: { origin: 'https://khzanah.com' }, addEventListener: (name, callback) => { handlers[name] = callback } },
    URL, Response, caches: { match: async key => { requested.push(key); return font } },
    fetch: () => { throw Error('offline') },
  })
  let result
  handlers.fetch({ request: { method: 'GET', url: 'https://khzanah.com/fonts/hafs-uthmani.ttf' }, respondWith: promise => { result = promise }, waitUntil() {} })
  assert.equal(await result, font)
  assert.deepEqual(requested, ['https://khzanah.com/assets/fonts/verified-hafs.ttf'])
})

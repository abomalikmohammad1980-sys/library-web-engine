import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const worker = await readFile(new URL('../app/public/sw.js', import.meta.url), 'utf8')

function dispatch(fetcher, cached) {
  const handlers = new Map()
  const calls = []
  const context = {
    self: { location: { origin: 'https://khzanah.com' }, addEventListener: (name, handler) => handlers.set(name, handler) },
    fetch: request => { calls.push('network'); return fetcher(request) },
    caches: { match: request => { calls.push('cache'); return Promise.resolve(cached(request)) } },
    URL, Request, Response, console,
  }
  vm.runInNewContext(worker, context)
  let response
  handlers.get('fetch')({
    request: new Request('https://khzanah.com/data/heading-release.json'),
    respondWith: value => { response = value },
  })
  return { calls, response }
}

test('heading release goes straight to the network without CacheStorage lookup', async () => {
  const { calls, response } = dispatch(async () => new Response('current'), () => new Response('old'))
  assert.equal(await (await response).text(), 'current')
  assert.deepEqual(calls, ['network'])
})

test('heading release can still fall back to cached bytes when offline', async () => {
  const { calls, response } = dispatch(async () => { throw Error('offline') }, () => new Response('offline-copy'))
  assert.equal(await (await response).text(), 'offline-copy')
  assert.deepEqual(calls, ['network', 'cache'])
})

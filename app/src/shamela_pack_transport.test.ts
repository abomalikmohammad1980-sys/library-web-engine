import {expect,it,vi} from 'vitest'
import {fetchShamelaPackBytes} from './shamela_pack_transport'

const abcSha='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
it('recovers a stale same-length cache response against the manifest checksum',async()=>{
 const f=vi.fn().mockResolvedValueOnce(new Response('old')).mockResolvedValueOnce(new Response('abc'))
 expect(new TextDecoder().decode(await fetchShamelaPackBytes('/book',3,f,20000,abcSha))).toBe('abc')
 expect(f).toHaveBeenCalledTimes(2)
 expect(f.mock.calls[0][0]).toBe(`/book?shamela_sha256=${abcSha}`)
 expect(f.mock.calls[0][1].cache).toBe('no-store')
 expect(f.mock.calls[1][0]).toBe('/book')
 expect(f.mock.calls[1][1].cache).toBe('reload')
})
it('still rejects repeated corrupt content after one cache-isolated recovery',async()=>{
 const f=vi.fn().mockImplementation(async()=>new Response('old'))
 await expect(fetchShamelaPackBytes('/book',3,f,20000,abcSha)).rejects.toMatchObject({code:'shamela_pack_book_checksum_mismatch'})
 expect(f).toHaveBeenCalledTimes(2)
})

it('recovers one failed network request without a page reload',async()=>{
 const f=vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(new Response('abc'))
 expect(new TextDecoder().decode(await fetchShamelaPackBytes('/book',3,f))).toBe('abc')
 expect(f).toHaveBeenCalledTimes(2);expect(f.mock.calls[1][1].cache).toBe('no-store')
})
it('recovers a failure after headers while reading the body',async()=>{
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array([97]));c.error(new TypeError('connection reset'))}})
 const f=vi.fn().mockResolvedValueOnce(new Response(stream)).mockResolvedValueOnce(new Response('abc'))
 expect(await fetchShamelaPackBytes('/book',3,f)).toEqual(new Uint8Array([97,98,99]))
 expect(f).toHaveBeenCalledTimes(2)
})
it('retries a transient server response, not a missing book',async()=>{
 const f=vi.fn().mockResolvedValueOnce(new Response('',{status:503})).mockResolvedValueOnce(new Response('abc'))
 expect((await fetchShamelaPackBytes('/book',3,f)).length).toBe(3)
 const missing=vi.fn().mockResolvedValue(new Response('',{status:404}))
 await expect(fetchShamelaPackBytes('/book',3,missing)).rejects.toMatchObject({code:'shamela_pack_book_http_404'})
 expect(missing).toHaveBeenCalledTimes(1)
})
it('falls back to the canonical verified URL if the checksum URL is unavailable',async()=>{
 const f=vi.fn().mockResolvedValueOnce(new Response(null,{status:404})).mockResolvedValueOnce(new Response('abc'))
 expect(new TextDecoder().decode(await fetchShamelaPackBytes('/book',3,f,20000,abcSha))).toBe('abc')
 expect(f.mock.calls.map(call=>call[0])).toEqual([`/book?shamela_sha256=${abcSha}`,'/book'])
})
it('never accepts or retries corrupt length or HTML as book data',async()=>{
 for(const response of [new Response('ab'),new Response('abcd'),new Response('abc',{headers:{'content-type':'text/html'}})]){
  const f=vi.fn().mockResolvedValue(response)
  await expect(fetchShamelaPackBytes('/book',3,f)).rejects.toThrow();expect(f).toHaveBeenCalledTimes(1)
 }
})
it('bounds retries and distinguishes transfer failure',async()=>{
 const f=vi.fn().mockRejectedValue(new TypeError('network'))
 await expect(fetchShamelaPackBytes('/book',3,f)).rejects.toMatchObject({code:'shamela_pack_book_download_failed'})
 expect(f).toHaveBeenCalledTimes(2)
})
it('deadline covers a stalled response body, not just headers',async()=>{
 const f=vi.fn().mockImplementation(async()=>new Response(new ReadableStream({})))
 await expect(fetchShamelaPackBytes('/book',3,f,10)).rejects.toMatchObject({code:'shamela_pack_book_download_timeout'})
 expect(f).toHaveBeenCalledTimes(2)
})
it('allows a large slow stream that makes continuous progress beyond the old total timeout',async()=>{
 const bytes=new TextEncoder().encode('abcdefgh')
 const f=vi.fn(async()=>new Response(new ReadableStream<Uint8Array>({
  async start(controller){for(const byte of bytes){await new Promise(resolve=>setTimeout(resolve,8));controller.enqueue(new Uint8Array([byte]))}controller.close()},
 })))
 expect(await fetchShamelaPackBytes('/book',bytes.length,f,25)).toEqual(bytes)
 expect(f).toHaveBeenCalledTimes(1)
})

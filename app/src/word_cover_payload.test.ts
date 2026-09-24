import {describe,it,expect} from 'vitest'
import {zipSync} from 'fflate'
import {wordCoverPayload} from './word_cover_payload'
describe('deferred Word cover payload',()=>{
 it('preserves the selected raster bytes and MIME type',()=>{
  const png=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5wAAAABJRU5ErkJggg==','base64'))
  const data=zipSync({'word/media/cover.png':png})
  expect(wordCoverPayload(data,'media/cover.png')).toEqual({bytes:png,mimeType:'image/png'})
 })
 it('keeps the fallback for absent, corrupt, or unsupported images',()=>{
  expect(wordCoverPayload(new Uint8Array())).toBeUndefined()
  expect(wordCoverPayload(new Uint8Array([1,2,3]))).toBeUndefined()
  const data=zipSync({'word/media/cover.bin':new Uint8Array([1,2,3])})
  expect(wordCoverPayload(data,'media/missing.png')).toBeUndefined()
  expect(wordCoverPayload(data,'media/cover.bin')).toBeUndefined()
 })
})

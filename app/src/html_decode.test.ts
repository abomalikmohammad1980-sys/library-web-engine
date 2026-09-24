import {describe,it,expect} from 'vitest'
import {decodeHtmlOriginal} from './html_decode'

describe('HTML original decoding',()=>{
 it('preserves UTF-8 text and normalizes line endings',()=>{
  expect(decodeHtmlOriginal(new TextEncoder().encode('<p>آية</p>\r\n'))).toBe('<p>آية</p>\n')
 })
 it('honors a declared legacy Arabic charset without changing source bytes',()=>{
  const head=new TextEncoder().encode('<meta charset="windows-1256"><p>')
  const tail=new TextEncoder().encode('</p>')
  const bytes=Uint8Array.from([...head,0xc7,0xe1,0xe1,0xe5,...tail])
  const original=bytes.slice()
  expect(decodeHtmlOriginal(bytes)).toContain('<p>الله</p>')
  expect(bytes).toEqual(original)
 })
 it('rejects undecodable unlabelled bytes rather than silently replacing characters',()=>{
  expect(()=>decodeHtmlOriginal(Uint8Array.from([0xff,0xfe,0xfd]))).toThrow()
 })
 it('rejects invalid or oversized originals',()=>{
  expect(()=>decodeHtmlOriginal(new Uint8Array())).toThrow('فارغ')
  expect(()=>decodeHtmlOriginal(new Uint8Array(20*1024*1024+1))).toThrow('يتجاوز')
 })
})

import {describe,expect,it} from 'vitest'
import {ReaderVirtualHeights} from './reader_virtual_window'

describe('long-book virtual page heights',()=>{
 it('maps the 8,497th deep link without allocating page nodes',()=>{
  const index=new ReaderVirtualHeights(10_766,557)
  const range=index.window(8497)
  expect(range).toEqual({start:8485,end:8509,before:8485*557,after:(10_766-8510)*557})
  expect(index.atOffset(index.prefix(8497))).toBe(8497)
  expect(index.atOffset(index.prefix(8498)-1)).toBe(8497)
  expect(index.atOffset(Number.MAX_SAFE_INTEGER)).toBe(10_765)
 })
 it('preserves offset mapping after pages expand and shrink around the viewport',()=>{
  const index=new ReaderVirtualHeights(10_766,557)
  index.set(3,900)
  index.set(8496,380)
  expect(index.prefix(4)).toBe(3*557+900)
  expect(index.prefix(8497)).toBe(8497*557+343-177)
  expect(index.atOffset(index.prefix(8497)+20)).toBe(8497)
  index.set(3,557)
  expect(index.prefix(8497)).toBe(8497*557-177)
  index.shiftAll(-20)
  expect(index.prefix(8497)).toBe(8497*537-177)
  expect(index.atOffset(index.prefix(8497))).toBe(8497)
  expect(index.window(0).start).toBe(0)
  expect(index.window(10_765).end).toBe(10_765)
 })
 it('rejects impossible measurements instead of corrupting distant jumps',()=>{
  const index=new ReaderVirtualHeights(2,100)
  index.set(1,15)
  expect(()=>index.shiftAll(-20)).toThrow('reader_virtual_shift_invalid')
  expect(index.prefix(2)).toBe(115)
  expect(()=>index.set(2,20)).toThrow('reader_virtual_height_invalid')
  expect(()=>index.set(1,0)).toThrow('reader_virtual_height_invalid')
  expect(()=>index.prefix(3)).toThrow('reader_virtual_prefix_invalid')
 })
})

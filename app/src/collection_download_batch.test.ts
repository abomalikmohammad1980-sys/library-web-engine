import {describe,expect,it,vi} from 'vitest'
import {createHash} from 'node:crypto'
import {COLLECTION_BATCH_BYTES,COLLECTION_SINGLE_BYTES,collectionBatchEnd,collectionDownloadContent,prepareCollectionBatch,prepareCollectionSingle,type CollectionDownloadAsset} from './collection_download_batch'
import {archiveEntryName,validateDownloadAttachment} from './download_attachment'
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex')
function asset(id='a',bytes=new Uint8Array([1,2,3])):CollectionDownloadAsset{return {id,fileName:'كتاب.txt',bytes:bytes.length,sha256:digest(bytes),load:async()=>new Response(bytes)}}
describe('download-only archives',()=>{
 it('accepts ZIP and both RAR signatures without decoding contents',()=>{
  expect(validateDownloadAttachment('كتب.ZIP',new Uint8Array([80,75,3,4,99]))).toBe('zip')
  expect(validateDownloadAttachment('كتب.rar',new Uint8Array([82,97,114,33,26,7,0]))).toBe('rar')
  expect(validateDownloadAttachment('كتب.rar',new Uint8Array([82,97,114,33,26,7,1,0]))).toBe('rar')
 })
 it('rejects mismatched extensions, executable signatures and empty files',()=>{
  expect(()=>validateDownloadAttachment('a.rar',new Uint8Array([80,75,3,4]))).toThrow('signature')
  expect(()=>validateDownloadAttachment('a.zip',new Uint8Array([77,90]))).toThrow('signature')
  expect(()=>validateDownloadAttachment('a.zip',new Uint8Array())).toThrow('size')
 })
 it('removes archive paths and Windows special names',()=>{
  expect(archiveEntryName('../a\\b\u202e.zip')).toBe('..-a-b-.zip')
  expect(archiveEntryName('CON.zip')).toBe('_CON.zip')
  expect(archiveEntryName('')).toBe('file')
 })
})
describe('bounded collection downloads',()=>{
 it('reuses an exact download buffer but never leaks bytes outside a subarray',()=>{
  const full=new Uint8Array([1,2,3]);expect(collectionDownloadContent(full)).toBe(full.buffer)
  const window=full.subarray(1,3),content=collectionDownloadContent(window)
  expect(content).not.toBe(full.buffer);expect([...new Uint8Array(content)]).toEqual([2,3])
 })
 it('splits by count and byte budget without fetching',()=>{
  expect(collectionBatchEnd(Array.from({length:30},()=>asset()),0)).toBe(20)
  const large={...asset(),bytes:COLLECTION_BATCH_BYTES/2}
  expect(collectionBatchEnd([large,large,large],0)).toBe(2)
  expect(collectionBatchEnd([asset(),{...asset(),bytes:COLLECTION_BATCH_BYTES+1}],0)).toBe(1)
  expect(()=>collectionBatchEnd([{...asset(),bytes:COLLECTION_BATCH_BYTES+1}],0)).toThrow('single_required')
 })
 it('rejects invalid metadata before downloading',async()=>{
  const load=vi.fn()
  await expect(prepareCollectionBatch([{...asset(),bytes:COLLECTION_BATCH_BYTES+1,load}],0,new AbortController().signal)).rejects.toThrow('single_required')
  expect(load).not.toHaveBeenCalled()
  expect(()=>collectionBatchEnd([asset()],-1)).toThrow('cursor')
 })
 it('loads sequentially and preserves originals and duplicate filenames',async()=>{
  let active=0,maximum=0
  const inputs=[asset('first'),asset('second')].map(a=>({...a,load:async()=>{active++;maximum=Math.max(maximum,active);await Promise.resolve();active--;return new Response(new Uint8Array([1,2,3]))}}))
  const batch=await prepareCollectionBatch(inputs,0,new AbortController().signal)
  expect(maximum).toBe(1);expect(batch.nextIndex).toBe(2);expect(batch.bytes).toBe(6)
  expect(batch.entries.map(e=>e.name)).toEqual(['00001-كتاب.txt','00002-كتاب.txt'])
  expect([...batch.entries[0]!.bytes]).toEqual([1,2,3])
 })
 it('rejects altered or truncated responses',async()=>{
  await expect(prepareCollectionBatch([{...asset(),load:async()=>new Response(new Uint8Array([9,2,3]))}],0,new AbortController().signal)).rejects.toThrow('digest')
  await expect(prepareCollectionBatch([{...asset(),load:async()=>new Response(new Uint8Array([1]))}],0,new AbortController().signal)).rejects.toThrow('length')
 })
 it('does not start another file after cancellation',async()=>{
  const controller=new AbortController(),second=vi.fn()
  await expect(prepareCollectionBatch([asset(),{...asset(),load:second}],0,controller.signal,()=>controller.abort())).rejects.toMatchObject({name:'AbortError'})
  expect(second).not.toHaveBeenCalled()
 })
 it('never starts a network request for a cancelled batch',async()=>{
  const controller=new AbortController();controller.abort();const load=vi.fn()
  await expect(prepareCollectionBatch([{...asset(),load}],0,controller.signal)).rejects.toMatchObject({name:'AbortError'})
  expect(load).not.toHaveBeenCalled()
 })
 it('rejects excess streamed bytes even without Content-Length',async()=>{
  await expect(prepareCollectionBatch([{...asset(),load:async()=>new Response(new Uint8Array([1,2,3,4]))}],0,new AbortController().signal)).rejects.toThrow('length')
 })
 it('saves one 50–64 MiB original exactly and refuses a mismatched digest',async()=>{
  const bytes=new Uint8Array(COLLECTION_BATCH_BYTES+1);bytes[0]=80;bytes[bytes.length-1]=75
  const original={...asset('large',bytes),load:async()=>new Response(bytes)}
  const saved=await prepareCollectionSingle(original,new AbortController().signal)
  expect(saved.length).toBe(bytes.length);expect(saved[0]).toBe(80);expect(saved.at(-1)).toBe(75)
  await expect(prepareCollectionSingle({...original,sha256:'0'.repeat(64)},new AbortController().signal)).rejects.toThrow('digest')
  await expect(prepareCollectionSingle({...original,bytes:COLLECTION_SINGLE_BYTES+1},new AbortController().signal)).rejects.toThrow('size')
 })
})

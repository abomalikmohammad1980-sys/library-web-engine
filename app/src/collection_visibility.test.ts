import {expect,it,vi} from 'vitest'
import {collectionVisibilityUrl,readCollectionVisibility} from './collection_visibility'
const signal=()=>new AbortController().signal
const row={bookId:'1',visibility:'public',logicallyDeleted:false}
const response=(overrides:unknown[])=>Response.json({schemaVersion:1,overrides})
it('scopes a verified Shamela book to its indexed two-ID visibility query',()=>{
 expect(collectionVisibilityUrl({id:'410000907',sourceKind:'shamela4.1',sourceBookId:'907'})).toBe('/api/library/central-overrides?bookId=410000907')
 expect(collectionVisibilityUrl({id:'410000907',sourceKind:'shamela4.1',sourceBookId:'2146'})).toBe('/api/library/central-overrides')
 expect(collectionVisibilityUrl({id:'other',sourceKind:'published'})).toBe('/api/library/central-overrides')
})
it('accepts explicit public, hidden and deleted records without changing them',async()=>{
 const rows=[row,{...row,bookId:'2',visibility:'hidden',logicallyDeleted:true}]
 expect(await readCollectionVisibility(response(rows),signal())).toEqual(rows)
})
it('rejects duplicate and malformed records rather than choosing the first',async()=>{
 for(const rows of [[row,{...row,visibility:'hidden'}],[{...row,bookId:''}],[{...row,logicallyDeleted:'false'}]])await expect(readCollectionVisibility(response(rows),signal())).rejects.toThrow('invalid')
})
it('bounds streamed bytes even without Content-Length and cancels overflow',async()=>{
 const cancel=vi.fn();const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(1024*1024+1))},cancel})
 await expect(readCollectionVisibility(new Response(stream),signal())).rejects.toThrow('size');expect(cancel).toHaveBeenCalled()
})
it('rejects an oversized declared response before reading and cancels it',async()=>{
 await expect(readCollectionVisibility(new Response('{}',{headers:{'content-length':'1048577'}}),signal())).rejects.toThrow('size')
})
it('cancels a stalled read on logout or timeout',async()=>{
 const controller=new AbortController(),cancel=vi.fn()
 const pending=readCollectionVisibility(new Response(new ReadableStream({cancel})),controller.signal)
 controller.abort()
 await expect(pending).rejects.toMatchObject({name:'AbortError'});expect(cancel).toHaveBeenCalled()
})
it('fails closed on invalid UTF-8 and server errors',async()=>{
 await expect(readCollectionVisibility(new Response(new Uint8Array([255])),signal())).rejects.toThrow()
 await expect(readCollectionVisibility(new Response('{}',{status:503}),signal())).rejects.toThrow('unavailable')
})

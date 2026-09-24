import {expect,it,vi} from 'vitest'
import {loadPublicCategoryCollection} from './public_collection_refs'
const signal=()=>new AbortController().signal
it('enumerates all pages sequentially, never just the visible page',async()=>{
 const fetcher=vi.fn(async()=>new Response('page'))
 const parse=vi.fn((_html:string,_path:string,page:number)=>({books:[{id:String(page),title:'كتاب'}],hasMore:page<3}))
 const books=await loadPublicCategoryCollection('علوم القرآن',signal(),{fetch:fetcher,parse,origin:'https://example.test'})
 expect(books.map(b=>b.id)).toEqual(['1','2','3']);expect(fetcher).toHaveBeenCalledTimes(3)
 expect(fetcher.mock.calls[0]).toEqual(['/categories/'+encodeURIComponent('علوم القرآن'),expect.objectContaining({credentials:'omit',redirect:'error'})])
})
it('does not return a partial collection on a later network failure',async()=>{
 let calls=0
 await expect(loadPublicCategoryCollection('قسم',signal(),{origin:'https://example.test',fetch:async()=>new Response('page',{status:++calls===1?200:503}),parse:()=>({books:[{id:'1',title:'كتاب'}],hasMore:true})})).rejects.toThrow('unavailable')
})
it('rejects repeated identifiers instead of silently accepting a changed page range',async()=>{
 await expect(loadPublicCategoryCollection('قسم',signal(),{origin:'https://example.test',fetch:async()=>new Response('page'),parse:()=>({books:[{id:'1',title:'كتاب'}],hasMore:true})})).rejects.toThrow('changed')
})
it('does not fetch after cancellation',async()=>{
 const controller=new AbortController();controller.abort();const fetcher=vi.fn()
 await expect(loadPublicCategoryCollection('قسم',controller.signal,{origin:'https://example.test',fetch:fetcher})).rejects.toMatchObject({name:'AbortError'})
 expect(fetcher).not.toHaveBeenCalled()
})

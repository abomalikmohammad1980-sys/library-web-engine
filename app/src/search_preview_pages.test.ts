import {expect,it} from 'vitest'
import {previewBookPage} from './search_preview_pages'
import type {StoredBook} from './engine/library_store'
it('uses actual adjacent pages, not the next matching result or invented numbering',()=>{
 const book={bokPages:[{id:1,text:'مطابقة',part:1,page:90},{id:2,text:'سياق بلا مطابقة',part:2,page:5}]} as StoredBook
 expect(previewBookPage(book,1)).toEqual({text:'سياق بلا مطابقة',partLabel:'2',pageLabel:'5',index:1,total:2})
 for(const index of [-1,2,NaN,0.5])expect(previewBookPage(book,index)).toBeUndefined()
})

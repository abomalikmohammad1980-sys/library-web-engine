import {expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({outline:vi.fn(),destroy:vi.fn(),page:vi.fn()}))
vi.mock('./pdfjs_assets',()=>({pdfJsLocalAssets:()=>({})}))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url',()=>({default:'worker'}))
vi.mock('pdfjs-dist',()=>({GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve({numPages:20,getOutline:mocks.outline,getDestination:async()=>[7],getPageIndex:async()=>4,getPage:mocks.page}),destroy:mocks.destroy})}))
import {pdfHeadingIndex} from './pdf_heading_index'
it('indexes nested bookmarks with page anchors without reading page contents',async()=>{
 mocks.outline.mockResolvedValue([{title:'الباب',dest:[{}],items:[{title:'الفصل',dest:'target',items:[]}]}])
 expect(await pdfHeadingIndex(new Uint8Array([1]))).toEqual({complete:true,entries:[{value:'الباب',pageIndex:4},{value:'الفصل',pageIndex:7}]})
 expect(mocks.page).not.toHaveBeenCalled();expect(mocks.destroy).toHaveBeenCalled()
})
it('distinguishes a readable PDF without bookmarks from a failed source',async()=>{
 mocks.outline.mockResolvedValue(null)
 expect(await pdfHeadingIndex(new Uint8Array([1]))).toEqual({complete:true,entries:[]})
 mocks.outline.mockRejectedValue(Error('bad PDF'))
 await expect(pdfHeadingIndex(new Uint8Array([1]))).rejects.toThrow('bad PDF')
})

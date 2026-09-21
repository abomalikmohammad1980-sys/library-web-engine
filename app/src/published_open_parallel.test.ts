import {expect,it,vi} from 'vitest'
vi.mock('./pdf_import',()=>({pdfFirstPageCover:vi.fn(async()=>undefined)}))
import {materializePublishedWork,type PublishedWork} from './published_library_seed'

it('starts all independent reader assets before any network response, preserving source and page-map validation',async()=>{
 const work:PublishedWork={id:'parallel-fixture',title:'اختبار',author:'مؤلف',status:'ready',security:{verdict:'allow',reasons:[]},metadata:{},coverStrategy:'generated',wordArtifact:{path:'/map',totalPages:1,paragraphCount:1},sources:[{format:'word',role:'primary',path:'/word',fileName:'a.docx',bytes:3,sha256:'0'.repeat(64)},{format:'pdf',role:'alternate',path:'/pdf',fileName:'a.pdf',bytes:3,sha256:'1'.repeat(64)}]}
 const started:string[]=[]
 let release!:()=>void
 const gate=new Promise<void>(resolve=>{release=resolve})
 const pending=materializePublishedWork(work,async source=>{started.push(source.path);await gate;return new Uint8Array(source.format==='word'?[1,2,3]:[4,5,6])},async path=>{started.push(path);await gate;return {totalPages:1,paragraphCount:1,starts:[{paragraphIndex:0,physicalPage:1,adjustedPage:1}],pages:[{physicalPage:1,adjustedPage:1,firstParagraphIndex:0,lastParagraphIndex:0,firstText:'أ',lastText:'أ'}]}})
 expect(started.sort()).toEqual(['/map','/pdf','/word'])
 release()
 const book=await pending
 expect([...book.data]).toEqual([1,2,3]);expect([...book.pdfData!]).toEqual([4,5,6])
 expect(book.wordPageMap?.totalPages).toBe(1)
 await expect(materializePublishedWork(work,async()=>new Uint8Array(3),async()=>({}))).rejects.toThrow('published_word_map_incomplete')
})

import {it,expect} from 'vitest'
import {centralBookUploadInput} from './central_book_upload'
import type {StoredBook} from './engine/library_store'
const book=()=>({id:'private-local',ownerScope:'secret',title:'كتاب',author:'مؤلف',fileName:'book.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',data:new Uint8Array([1,2]),fileSize:2,addedAt:1,originalSha256:'x',pdfStatus:'pending',sourceFormat:'word'} as StoredBook)
it('ships every JPEG original in reviewed order with a separate reading derivative',async()=>{
 const stored={...book(),sourceFormat:'jpeg',volumes:[{number:1,fileName:'second.jpg',data:new Uint8Array([2]),mimeType:'image/jpeg'},{number:2,fileName:'first.jpg',data:new Uint8Array([1]),mimeType:'image/jpeg'}],pdfData:new TextEncoder().encode('%PDF-1.7'),pdfFileName:'reading.pdf',pdfStatus:'ready'} as StoredBook
 const result=centralBookUploadInput({localBookId:stored.id,book:stored,metadata:stored,files:[]})
 expect(result.file.name).toBe('second.jpg');expect(result.file.type).toBe('image/jpeg');expect(result.volumeFiles?.map(file=>file.name)).toEqual(['first.jpg']);expect(result.pdfFile?.name).toBe('reading.pdf')
 expect(new Uint8Array(await result.file.arrayBuffer())).toEqual(new Uint8Array([2]))
})
it('publishes preserved original BOK bytes rather than derived reader JSON',async()=>{
 const bytes=new Uint8Array(32);bytes.set(new TextEncoder().encode('Standard Jet DB'),4)
 const stored={...book(),sourceFormat:'shamela-bok',fileName:'book.catalog.json',mimeType:'application/json',data:new TextEncoder().encode('{}'),sourceData:bytes} as StoredBook
 const input=centralBookUploadInput({book:stored,metadata:{title:'كتاب',author:'مؤلف'},localBookId:stored.id,files:[]})
 expect(input.file.name).toBe('book.bok');expect(input.file.type).toBe('application/x-shamela-bok');expect(new Uint8Array(await input.file.arrayBuffer())).toEqual(bytes)
 delete stored.sourceData
 expect(()=>centralBookUploadInput({book:stored,metadata:{title:'كتاب',author:'مؤلف'},localBookId:stored.id,files:[]})).toThrow('bok_original_source_unavailable')
})
it('projects reviewed public metadata without private book state',()=>{
 const stored={...book(),publisher:'الناشر',description:'الوصف',readerModel:{secret:true},sourceData:new Uint8Array([99])} as unknown as StoredBook
 const input=centralBookUploadInput({book:stored,metadata:{title:'عنوان مراجع',author:'اسم مراجع',publisher:'دار',authorId:'central-author:00000000-0000-4000-8000-000000000000'},localBookId:stored.id,files:[]})
 expect(input.title).toBe('عنوان مراجع');expect(input.metadata?.publisher).toBe('دار')
 expect(input.metadata?.centralAuthorId).toBe('central-author:00000000-0000-4000-8000-000000000000')
 expect(JSON.stringify(input.metadata)).not.toMatch(/secret|ownerScope|readerModel|sourceData|private-local/)
})
it('preserves an explicit catalog primary author identity and omits a private local one',()=>{
 const stored=book(),base={book:stored,localBookId:stored.id,files:[]}
 expect(centralBookUploadInput({...base,metadata:{title:'كتاب',author:'مؤلف',authorId:'shamela-author-267'}}).metadata?.authorId).toBe('shamela-author-267')
 expect(centralBookUploadInput({...base,metadata:{title:'كتاب',author:'مؤلف',authorId:'private-author'}}).metadata?.authorId).toBeUndefined()
})
it('keeps multipart sources, custom cover and ready PDF without duplicating part one',async()=>{
 const stored={...book(),volumes:[{number:1,fileName:'one.docx',data:new Uint8Array([1]),mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},{number:2,fileName:'two.docx',data:new Uint8Array([2]),mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}],customCoverData:new Uint8Array([3]),customCoverMimeType:'image/png',pdfData:new Uint8Array([4]),pdfStatus:'ready',parts:[{number:1,startPage:1,endPage:8}]} as StoredBook
 const input=centralBookUploadInput({book:stored,metadata:{title:'كتاب',author:'مؤلف'},localBookId:stored.id,files:[]})
 expect(input.file.name).toBe('one.docx');expect(input.volumeFiles?.map(f=>f.name)).toEqual(['two.docx'])
 expect(input.coverFile?.type).toBe('image/png');expect(input.pdfFile?.type).toBe('application/pdf');expect(input.metadata?.parts).toEqual(stored.parts)
})

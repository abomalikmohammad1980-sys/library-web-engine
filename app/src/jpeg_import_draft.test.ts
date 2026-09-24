import {it,expect} from 'vitest'
import {prepareJpegImportDraft,prepareJpegBookDraft,jpegImportGroups} from './jpeg_import_draft'
const bytes=new Uint8Array([255,216,255,192,0,11,8,0,2,0,3,1,1,17,0,255,217])
it('supports combined or separate books without changing the reviewed image order',()=>{
 const files=[new File([bytes],'2.jpg'),new File([bytes],'1.jpg')]
 expect(jpegImportGroups(files,'combined')).toEqual([files])
 expect(jpegImportGroups(files,'separate')).toEqual([[files[0]],[files[1]]])
 expect(()=>jpegImportGroups([],'combined')).toThrow()
 expect(()=>jpegImportGroups([new File([bytes],'x.html')],'separate')).toThrow()
 expect(()=>jpegImportGroups(Array.from({length:201},()=>files[0]!),'combined')).toThrow()
})
it('keeps the original name/MIME/bytes separate from the reading PDF',async()=>{
 const file=new File([bytes],'كتاب_مصوّر.JPEG',{type:'image/jpeg'})
 const draft=await prepareJpegImportDraft(file,'المؤلف',async input=>{input.fill(0);return new TextEncoder().encode('%PDF-1.7\n')})
 expect(draft.data).toEqual(bytes);expect(draft.file).toBe(file);expect(draft.mimeType).toBe('image/jpeg')
 expect(draft.readingPdfFileName).toBe('كتاب_مصوّر.pdf');expect(draft.title).toBe('كتاب مصوّر')
})
it('fails before storing anything if the derivative is invalid or conversion fails',async()=>{
 const file=new File([bytes],'page.jpg')
 await expect(prepareJpegImportDraft(file,'',async()=>new Uint8Array())).rejects.toThrow('PDF')
 await expect(prepareJpegImportDraft(file,'',async()=>{throw Error('decode failed')})).rejects.toThrow('decode failed')
})
it('prepares all originals in reviewed order even with duplicate filenames',async()=>{
 const other=bytes.slice();other[10]=4
 const files=[new File([other],'page.jpg'),new File([bytes],'page.jpg')]
 const draft=await prepareJpegBookDraft(files,'كاتب',{convert:async sources=>{
   expect(sources.map(source=>source.bytes[10])).toEqual([4,3])
   sources.forEach(source=>source.bytes.fill(0))
   return new TextEncoder().encode('%PDF-1.7\n')
 }})
 expect(draft.originals.map(original=>original.file)).toEqual(files)
 expect(draft.originals.map(original=>original.data[10])).toEqual([4,3])
})
it('does not convert a partially valid collection',async()=>{
 let conversions=0
 await expect(prepareJpegBookDraft([new File([bytes],'a.jpg'),new File(['bad'],'b.jpg')],'',{convert:async()=>{conversions++;return bytes}})).rejects.toThrow()
 expect(conversions).toBe(0)
})
it('discards conversion results if the operation was cancelled',async()=>{
 const controller=new AbortController()
 await expect(prepareJpegBookDraft([new File([bytes],'a.jpg')],'',{signal:controller.signal,convert:async()=>{
   controller.abort();return new TextEncoder().encode('%PDF-1.7\n')
 }})).rejects.toThrow()
 let reads=0
 const file=new File([bytes],'a.jpg');file.arrayBuffer=async()=>{reads++;return bytes.buffer}
 await expect(prepareJpegBookDraft([file],'',{signal:controller.signal})).rejects.toThrow()
 expect(reads).toBe(0)
})

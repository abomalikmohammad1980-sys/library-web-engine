import {expect,it,vi} from 'vitest'
import {createPublicReaderRegistry} from './public_reader_registry'
import {readFileSync} from 'node:fs'
const original={identity:'central-submission:src-one',publicId:'src-one',metadata:{id:'src-one',title:'عام',author:'مؤلف',category:null,mimeType:'text/plain',byteLength:2,createdAt:'2026-09-08 10:00:00',fileUrl:'/api/account/books/src-one/file',fileName:'book.txt',sourceFormat:'text' as const,publicationVersion:1},data:new Uint8Array([65,66]),integrity:{kind:'size-and-format-only' as const}}
it('resolves the approved public namespace without private persistence or a fabricated SHA',async()=>{
 const load=vi.fn(async()=>original),registry=createPublicReaderRegistry(load)
 const book=await registry.resolve(original.identity)
 expect(book.id).toBe(original.identity);expect(registry.get(book.id)).toBe(book);expect(book.managedSource).toBe('published');expect(book.originalSha256).toBe('');expect(book.ownerScope).toBeUndefined()
 registry.release(book);expect(registry.get(book.id)).toBeUndefined()
})
it('rejects private IDs and propagates explicit unsupported or withdrawn failure without a stale record',async()=>{
 const load=vi.fn(async()=>{throw new Error('public_book_unavailable')}),registry=createPublicReaderRegistry(load)
 await expect(registry.resolve('private-id')).rejects.toThrow('public_book_id_invalid');expect(load).not.toHaveBeenCalled()
 await expect(registry.resolve(original.identity)).rejects.toThrow('public_book_unavailable');expect(registry.get(original.identity)).toBeUndefined()
})
it('retains only one source and stale cleanup cannot evict a replacement',async()=>{
 const registry=createPublicReaderRegistry(async()=>original),a=await registry.resolve(original.identity),b=await registry.resolve(original.identity)
 registry.release(a);expect(registry.get(original.identity)).toBe(b);registry.release(b);expect(registry.get(original.identity)).toBeUndefined()
})
it('reader branches before private lookup, does not persist public derivatives, and reports publication failures explicitly',()=>{
 const source=readFileSync(new URL('./screens/reader.ts',import.meta.url),'utf8')
 expect(source).toContain('publicSource ? await remoteRegistry.resolve(id,publicAbort.signal)')
 expect(source).toContain('createPublicReaderRegistry(resolveAccountBookOriginal,true)')
 for(const name of ['saveReaderModel','saveReaderPageCount','updateBokDerivedText'])expect(source).toMatch(new RegExp(`const ${name}:[^\\n]+isRemoteReaderId\\(id\\)\\?Promise.resolve\\(\\)`))
 expect(source).toContain("code==='public_book_unavailable'?'الكتاب غير متاح للنشر العام الآن'")
 expect(source).toContain("code==='public_book_format_unsupported'?'صيغة الكتاب المنشور تحتاج معالجة قبل القراءة'")
 expect(source).toContain("if (!publicSource && (!stored || (stored.managedSource === 'published' && !stored.data?.byteLength && !shamelaPreviewPageLoader(stored))))")
 expect(source).toContain('const remoteRegistry=isAccountReaderId(id)?accountReaderRegistry:publicReaderRegistry')
})

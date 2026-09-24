import {expect,it,vi} from 'vitest'
import {resolvePublicBookOriginal,loadPublicBookWithParser,describePublicOriginalDownloads} from './public_book_resolver'
import {createPublicReaderRegistry} from './public_reader_registry'
import {createHash} from 'node:crypto'
const book={id:'src-test',title:'عنوان',author:'مؤلف',category:null,mimeType:'application/pdf',byteLength:8,createdAt:'2026-09-08 10:00:00',fileUrl:'/api/account/books/src-test/file',fileName:'book.pdf',sourceFormat:'pdf',publicationVersion:1}
const meta=(changes={})=>new Response(JSON.stringify({schemaVersion:1,book:{...book,...changes}}),{headers:{'content-type':'application/json'}})
const bytes=()=>new Response('%PDF-123')
const fetches=(responses:Response[])=>vi.fn(async()=>responses.shift()!)
it('round-trips only hash-verified HTML companions and refuses a substituted image',async()=>{
 const source='<!doctype html><html><body><h1>كتاب</h1><img src="image.png"></body></html>',png=new Uint8Array([137,80,78,71,13,10,26,10]),id='12345678-1234-4234-8234-123456789abc'
 const resource={id,path:'image.png',mimeType:'image/png',byteLength:png.length,sha256:createHash('sha256').update(png).digest('hex'),fileUrl:`/api/account/books/src-test/file?htmlResource=${id}`}
 const html=()=>meta({sourceFormat:'html',fileName:'book.html',mimeType:'text/html',byteLength:new TextEncoder().encode(source).length,htmlResources:[resource]})
 const fetcher=fetches([html(),new Response(source),new Response(png),html()])
 const loaded=await resolvePublicBookOriginal('src-test',{fetch:fetcher})
 expect(loaded.htmlAssets).toEqual([{path:'image.png',mimeType:'image/png',data:png}])
 expect(fetcher.mock.calls.map(([url])=>url)).toContain(resource.fileUrl)
 await expect(resolvePublicBookOriginal('src-test',{fetch:fetches([html(),new Response(source),new Response(new Uint8Array(8))])})).rejects.toThrow('public_book_integrity_invalid')
 await expect(resolvePublicBookOriginal('src-test',{fetch:fetches([meta({sourceFormat:'html',fileName:'book.html',htmlResources:[{...resource,path:'../image.png'}]})])})).rejects.toThrow('public_book_metadata_invalid')
})
it('plans original downloads using metadata only and excludes generated PDFs and covers',async()=>{
 const asset={id:'12345678-1234-4234-8234-123456789abc',kind:'pdf',partNumber:null,fileName:'derived.pdf',mimeType:'application/pdf',byteLength:8,fileUrl:'/api/account/books/src-test/file?asset=12345678-1234-4234-8234-123456789abc'}
 const fetcher=fetches([meta({assets:[asset]}),meta({assets:[asset]}),bytes(),meta({assets:[asset]})])
 const plan=await describePublicOriginalDownloads('src-test',{fetch:fetcher})
 expect(fetcher).toHaveBeenCalledTimes(1);expect(plan).toHaveLength(1);expect(plan[0]).not.toHaveProperty('sha256')
 expect(new TextDecoder().decode(await (await plan[0]!.load(new AbortController().signal)).arrayBuffer())).toBe('%PDF-123')
 expect(fetcher.mock.calls.map(call=>(call as unknown as [string])[0])).not.toContain(asset.fileUrl)
})
it('refuses withdrawal before a planned download without fetching bytes',async()=>{
 const fetcher=fetches([meta(),new Response('{}',{status:404})])
 const plan=await describePublicOriginalDownloads('src-test',{fetch:fetcher})
 await expect(plan[0]!.load(new AbortController().signal)).rejects.toThrow('unavailable')
 expect(fetcher).toHaveBeenCalledTimes(2)
})
it('refuses a planned original if publication changes during download',async()=>{
 const fetcher=fetches([meta(),meta(),bytes(),meta({publicationVersion:2})])
 const plan=await describePublicOriginalDownloads('src-test',{fetch:fetcher})
 await expect(plan[0]!.load(new AbortController().signal)).rejects.toThrow('changed')
})
it('supplies validated original bytes to a parser without manufacturing a content SHA or private ownership',async()=>{
 const fetcher=fetches([meta(),bytes(),meta()]),parser=vi.fn(source=>source.data.length)
 expect(await loadPublicBookWithParser('src-test',parser,{fetch:fetcher})).toBe(8)
 const source=parser.mock.calls[0]![0];expect(source.identity).toBe('central-submission:src-test');expect(source.integrity).toEqual({kind:'size-and-format-only'});expect(source).not.toHaveProperty('ownerScope');expect(source).not.toHaveProperty('originalSha256')
 expect(fetcher).toHaveBeenCalledTimes(3)
})
it.each([404,403])('unknown/private status %s never fetches bytes',async status=>{
 const fetcher=fetches([new Response('{}',{status})]);await expect(resolvePublicBookOriginal('src-test',{fetch:fetcher})).rejects.toThrow('public_book_unavailable');expect(fetcher).toHaveBeenCalledTimes(1)
})
it.each([{sourceFormat:null},{fileName:'book.doc',sourceFormat:'word'},{byteLength:64*1024*1024+1},{fileUrl:'/api/account/books/another/file'},{fileName:'../book.pdf'},{visibility:'private'}])('rejects unsupported or unsafe metadata %j',async changes=>{
 const fetcher=fetches([meta(changes)]);await expect(resolvePublicBookOriginal('src-test',{fetch:fetcher})).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(1)
})
it('rejects size mismatch and disguised HTML instead of passing it to the parser',async()=>{
 for(const body of ['%PDF-shorter-than-declared','<html>xx']){const parser=vi.fn();await expect(loadPublicBookWithParser('src-test',parser,{fetch:fetches([meta(),new Response(body)])})).rejects.toThrow();expect(parser).not.toHaveBeenCalled()}
})
it('revalidates publication after downloading and refuses withdrawal or a changed revision',async()=>{
 for(const last of [new Response('{}',{status:404}),meta({publicationVersion:2})]){const parser=vi.fn();await expect(loadPublicBookWithParser('src-test',parser,{fetch:fetches([meta(),bytes(),last])})).rejects.toThrow();expect(parser).not.toHaveBeenCalled()}
})
it('refuses invalid public ID before fetching and aborts a deferred response without parsing',async()=>{
 const fetcher=vi.fn();await expect(resolvePublicBookOriginal('../private',{fetch:fetcher})).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled()
 let release!:(response:Response)=>void;const response=new Promise<Response>(r=>release=r),abort=new AbortController(),parser=vi.fn()
 const task=loadPublicBookWithParser('src-test',parser,{fetch:()=>response,signal:abort.signal});const rejected=expect(task).rejects.toThrow('public_book_aborted');abort.abort();release(meta());await rejected;expect(parser).not.toHaveBeenCalled()
})
it('hydrates only opened book assets and safe metadata, including cover/PDF/volume, then rechecks publication',async()=>{
 const uuid=(n:number)=>`12345678-1234-4234-8234-123456789ab${n}`
 const assets=[{id:uuid(1),kind:'volume',partNumber:2,fileName:'part2.pdf',mimeType:'application/pdf',byteLength:8},{id:uuid(2),kind:'pdf',partNumber:null,fileName:'attached.pdf',mimeType:'application/pdf',byteLength:8},{id:uuid(3),kind:'cover',partNumber:null,fileName:'cover.png',mimeType:'image/png',byteLength:8}].map(a=>({...a,fileUrl:`/api/account/books/src-test/file?asset=${a.id}`}))
 const metadata={schemaVersion:1,publisher:'دار النشر',centralAuthorId:'central-author:12345678-1234-1234-1234-123456789abc',parts:[{number:1,startPage:1,endPage:3}],tags:[{name:'فقه',source:'manual'}]}
 const png=new Uint8Array([137,80,78,71,13,10,26,10]),fetcher=fetches([meta({metadata,assets}),bytes(),bytes(),bytes(),new Response(png),meta({metadata,assets})])
 const registry=createPublicReaderRegistry((id,options)=>resolvePublicBookOriginal(id,{...options,fetch:fetcher})),result=await registry.resolve('central-submission:src-test')
 expect(result.publisher).toBe('دار النشر');expect(result.authorId).toBe(metadata.centralAuthorId);expect(result.volumes?.map(v=>v.number)).toEqual([1,2]);expect(result.customCoverData).toEqual(png);expect(result.pdfFileName).toBe('attached.pdf');expect(result.parts).toEqual(metadata.parts);expect(result.tags).toEqual(metadata.tags);expect(fetcher).toHaveBeenCalledTimes(6)
})
it('does not return partially downloaded assets after withdrawal or changed asset manifest',async()=>{
 const asset={id:'12345678-1234-4234-8234-123456789abc',kind:'pdf',partNumber:null,fileName:'attached.pdf',mimeType:'application/pdf',byteLength:8,fileUrl:'/api/account/books/src-test/file?asset=12345678-1234-4234-8234-123456789abc'}
 await expect(resolvePublicBookOriginal('src-test',{fetch:fetches([meta({assets:[asset]}),bytes(),bytes(),meta({assets:[]})])})).rejects.toThrow('public_book_changed')
})

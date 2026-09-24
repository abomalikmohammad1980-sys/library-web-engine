import {expect,it,vi} from 'vitest'
import {gzipSync,strToU8} from 'fflate'
import {fetchPagesDataAsset} from './pages_data_release'
import {createShamelaPreviewBook,fetchShamelaReaderShard,loadShamelaReaderEarlyWindow,loadShamelaReaderWindow,locateShamelaReaderShardRef,shamelaPreviewPageLoaded,shamelaPreviewPageLoader,shamelaReaderWindow,validateShamelaReaderShardIndex,type ShamelaReaderShardIndex} from './shamela_reader_shards'

vi.mock('./pages_data_release',()=>({fetchPagesDataAsset:vi.fn()}))
const SHA='a'.repeat(64)
it('locates a large book absent from the author index without scanning batch manifests',async()=>{
 const ref={bookId:'5678',batchId:'batch-0018',sourceSha256:SHA,indexPath:'batch-0018/books/5678/index.json.gz',indexBytes:100,indexSha256:SHA,counts:{pages:124569,titles:136957}}
 vi.mocked(fetchPagesDataAsset).mockReset().mockImplementation(async()=>Response.json({contract:'shamela-reader-shards/catalog-1',minBytes:2097152,books:[ref]}))
 expect(await locateShamelaReaderShardRef('5678')).toEqual(ref)
 expect(await locateShamelaReaderShardRef('missing')).toBeUndefined()
 expect(fetchPagesDataAsset).toHaveBeenCalledTimes(1)
 vi.mocked(fetchPagesDataAsset).mockReset()
})
function sample():ShamelaReaderShardIndex{return {contract:'shamela-reader-shards/1',workId:'shamela4_1:907',sourceSha256:SHA,counts:{pages:1050,titles:1},metadata:{bookName:'كتاب',bookDate:null,categoryId:null,metaDataRaw:null},authors:[],category:null,titles:[{sourceRowId:'1',pageSourceRowId:'1',parentSourceRowId:null,title:'الباب'}],pageRefs:Array.from({length:1050},(_,i)=>({sourceRowId:String(i+1),part:'1',page:i+1,number:null})),shards:[{path:'pages-0000.json.gz',start:0,count:512,bytes:10,sha256:SHA},{path:'pages-0001.json.gz',start:512,count:512,bytes:10,sha256:SHA},{path:'pages-0002.json.gz',start:1024,count:26,bytes:10,sha256:SHA}]}}
it('selects the 20-before/20-after window while preserving full TOC and page coverage',()=>{
 const index=validateShamelaReaderShardIndex(sample(),'shamela4_1:907',SHA,1050,1)
 expect(index.titles).toHaveLength(1)
 expect(shamelaReaderWindow(index,849)).toMatchObject({first:829,last:869,shards:[{start:512}]})
 expect(shamelaReaderWindow(index,511).shards.map(x=>x.start)).toEqual([0,512])
 expect(shamelaReaderWindow(index,1049)).toMatchObject({first:1029,last:1049,shards:[{start:1024}]})
 expect(()=>validateShamelaReaderShardIndex({...index,shards:index.shards.slice(0,2)},index.workId,SHA,1050,1)).toThrow('coverage')
})
it('authenticates a gzip page group before exposing text',async()=>{
 const index=sample(),pages=[{sourceRowId:'513',sequence:512,part:'1',page:513,body:'نص الصفحة',foot:null}]
 const bytes=gzipSync(strToU8(JSON.stringify({contract:index.contract,workId:index.workId,sourceSha256:index.sourceSha256,start:512,pages})))
 const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')
 index.shards[1]={...index.shards[1]!,count:1,bytes:bytes.length,sha256:sha}
 vi.mocked(fetchPagesDataAsset).mockResolvedValue(new Response(bytes,{headers:{'content-type':'application/gzip'}}))
 const sharedFetcher=vi.fn<typeof fetch>()
 const [first,second]=await Promise.all([fetchShamelaReaderShard(index,index.shards[1]!,'reader-shards/batch-0008/books/907/',sharedFetcher),fetchShamelaReaderShard(index,index.shards[1]!,'reader-shards/batch-0008/books/907/',sharedFetcher)])
 expect(first).toEqual(pages)
 expect(second).toBe(first)
 expect(fetchPagesDataAsset).toHaveBeenCalledTimes(1)
 vi.mocked(fetchPagesDataAsset).mockResolvedValue(new Response(new Uint8Array(bytes.length),{headers:{'content-type':'application/gzip'}}))
 await expect(fetchShamelaReaderShard(index,index.shards[1]!,'reader-shards/batch-0008/books/907/',vi.fn<typeof fetch>())).rejects.toThrow('integrity')
})
it('opens the requested page and nearby pages with complete TOC but without other page groups',async()=>{
 const sourceSha=SHA,workId='shamela4_1:907',pageGroups=[[{sourceRowId:'1',sequence:0,part:'1',page:1,body:'الأولى',foot:null},{sourceRowId:'2',sequence:1,part:'1',page:2,body:'الثانية',foot:null}],[{sourceRowId:'3',sequence:2,part:'1',page:3,body:'الثالثة',foot:null}]]
 const hash=async(bytes:Uint8Array<ArrayBuffer>)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')
 const encoded=pageGroups.map((pages,i)=>gzipSync(strToU8(JSON.stringify({contract:'shamela-reader-shards/1',workId,sourceSha256:sourceSha,start:i?2:0,pages}))))
 const shards=await Promise.all(encoded.map(async(bytes,i)=>({path:`pages-${String(i).padStart(4,'0')}.json.gz`,start:i?2:0,count:pageGroups[i]!.length,bytes:bytes.length,sha256:await hash(bytes)})))
 const index={...sample(),counts:{pages:3,titles:1},pageRefs:sample().pageRefs.slice(0,3),shards},indexBytes=strToU8(JSON.stringify(index)),catalog={contract:'shamela-reader-shards/catalog-1',minBytes:1,books:[{bookId:'907',batchId:'batch-0008',sourceSha256:sourceSha,indexPath:'batch-0008/books/907/index.json',indexBytes:indexBytes.length,indexSha256:await hash(indexBytes),counts:index.counts}]}
 vi.mocked(fetchPagesDataAsset).mockClear()
 vi.mocked(fetchPagesDataAsset).mockImplementation(async(_group,path)=>new Response(path==='reader-shards/catalog.json'?strToU8(JSON.stringify(catalog)):path.endsWith('/index.json')?indexBytes:path.endsWith('pages-0000.json.gz')?encoded[0]:encoded[1]))
 const result=await loadShamelaReaderWindow('907','batch-0008',sourceSha,workId,3,1,2)
 expect(result?.pages.map(page=>page.body)).toEqual(['الأولى','الثانية','الثالثة'])
 expect(result?.index.titles).toHaveLength(1)
 expect(vi.mocked(fetchPagesDataAsset).mock.calls.map(call=>call[1])).toEqual(['reader-shards/catalog.json','reader-shards/batch-0008/books/907/index.json','reader-shards/batch-0008/books/907/pages-0000.json.gz','reader-shards/batch-0008/books/907/pages-0001.json.gz'])
 const compressedIndex=gzipSync(indexBytes)
 catalog.books[0]!.indexPath='batch-0008/books/907/index.json.gz';catalog.books[0]!.indexBytes=compressedIndex.length;catalog.books[0]!.indexSha256=await hash(compressedIndex)
 vi.mocked(fetchPagesDataAsset).mockImplementation(async(_group,path)=>new Response(path==='reader-shards/catalog.json'?strToU8(JSON.stringify(catalog)):path.endsWith('/index.json.gz')?compressedIndex:path.endsWith('pages-0000.json.gz')?encoded[0]:encoded[1]))
 expect((await loadShamelaReaderWindow('907','batch-0008',sourceSha,workId,3,1,2))?.pages).toHaveLength(3)
})
it('keeps absent text explicitly unloaded and retrieves a distant group on demand',async()=>{
 const index=sample(),loaded=index.pageRefs.slice(512,1024).map((ref,i)=>({...ref,sequence:512+i,body:`المتن ${512+i}`,foot:null}))
 const book=createShamelaPreviewBook({index,first:512,last:1023,pages:loaded},'907','batch-0008','كتاب')
 expect(book.bokPages).toHaveLength(1050)
 expect(book.bokPages?.[849]?.text).toContain('المتن 849')
 expect(book.bokPages?.[20]?.text).toBe('')
 expect(book.bokToc).toHaveLength(1)
 const first=index.pageRefs.slice(0,512).map((ref,i)=>({...ref,sequence:i,body:i===21?'':`المتن ${i}`,foot:null}))
 const encoded=gzipSync(strToU8(JSON.stringify({contract:index.contract,workId:index.workId,sourceSha256:index.sourceSha256,start:0,pages:first})))
 const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',encoded))].map(x=>x.toString(16).padStart(2,'0')).join('')
 index.shards[0]={...index.shards[0]!,bytes:encoded.length,sha256:sha}
 vi.mocked(fetchPagesDataAsset).mockResolvedValue(new Response(encoded))
 await shamelaPreviewPageLoader(book)!(20)
 expect(book.bokPages?.[20]?.text).toBe('المتن 20')
 expect(book.bokPages?.[21]?.text).toBe('')
 expect(shamelaPreviewPageLoaded(book,21)).toBe(true)
 expect(book.bokPages?.[1024]?.text).toBe('')
})
it('shows a large-book page from a tiny route before fetching its full TOC',async()=>{
 const index=sample(),pages=index.pageRefs.slice(512,1024).map((ref,i)=>({...ref,sequence:512+i,body:`المتن ${512+i}`,foot:null}))
 const compressed=gzipSync(strToU8(JSON.stringify({contract:index.contract,workId:index.workId,sourceSha256:index.sourceSha256,start:512,pages})))
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',compressed))].map(x=>x.toString(16).padStart(2,'0')).join('')
 index.shards[1]={...index.shards[1]!,bytes:compressed.length,sha256:hash}
 const route={contract:'shamela-reader-shards/route-1',workId:index.workId,sourceSha256:index.sourceSha256,counts:index.counts,metadata:index.metadata,authors:index.authors,category:index.category,indexPath:'batch-0008/books/907/index.json',indexBytes:100,indexSha256:SHA,shards:index.shards}
 vi.mocked(fetchPagesDataAsset).mockClear()
 vi.mocked(fetchPagesDataAsset).mockImplementation(async(_group,path)=>new Response(path.endsWith('route.json')?strToU8(JSON.stringify(route)):compressed))
 const window=await loadShamelaReaderEarlyWindow('907','batch-0008',SHA,index.workId,1050,1,849)
 expect(window.first).toBe(829);expect(window.last).toBe(869)
 expect(vi.mocked(fetchPagesDataAsset).mock.calls.map(call=>call[1])).toEqual(['reader-shards/batch-0008/books/907/route.json','reader-shards/batch-0008/books/907/pages-0001.json.gz'])
 const book=createShamelaPreviewBook(window,'907','batch-0008','كتاب')
 expect(book.bokPages?.[849]?.text).toContain('المتن 849')
 expect(book.bokToc).toHaveLength(0)
})

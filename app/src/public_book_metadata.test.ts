import {it,expect} from 'vitest'
import {parsePublicBookMetadata,parsePublicBookAssets} from './public_book_metadata'
it('accepts ordered JPEG pages only under the image contract, preserving source count and MIME boundaries',()=>{
 const assets=Array.from({length:199},(_,i)=>{
  const id=`12345678-1234-4234-8234-${String(i).padStart(12,'0')}`
  return {id,kind:'volume',partNumber:i+2,mimeType:'image/jpeg',fileName:`page-${i+2}.jpg`,byteLength:20,fileUrl:`/api/account/books/images/file?asset=${id}`}
 })
 expect(parsePublicBookAssets(assets,'images',20,true)).toHaveLength(199)
 expect(()=>parsePublicBookAssets(assets,'images',20)).toThrow()
 expect(()=>parsePublicBookAssets(assets.slice(1),'images',20,true)).toThrow()
 expect(()=>parsePublicBookAssets([{...assets[0],mimeType:'text/html'}],'images',20,true)).toThrow()
 expect(()=>parsePublicBookAssets([{...assets[0],fileName:'page.html'}],'images',20,true)).toThrow()
})
it('accepts only safe intake metadata and preserves explicit author identity',()=>{expect(parsePublicBookMetadata({schemaVersion:1,publisher:'دار',authorId:'central-author:12345678-1234-1234-1234-123456789abc'})).toMatchObject({publisher:'دار'});expect(()=>parsePublicBookMetadata({schemaVersion:1,ownerScope:'private'})).toThrow()})
it('rejects forged cross-book, external, oversized and repeated assets',()=>{const a={id:'12345678-1234-4234-8234-123456789abc',kind:'pdf',partNumber:null,mimeType:'application/pdf',fileName:'a.pdf',byteLength:20,fileUrl:'/api/account/books/a/file?asset=12345678-1234-4234-8234-123456789abc'};expect(parsePublicBookAssets([a],'a',10)).toHaveLength(1);for(const bad of [{...a,fileUrl:a.fileUrl.replace('/a/','/b/')},{...a,fileUrl:'https://evil.test/a'},{...a,byteLength:64*1024*1024}])expect(()=>parsePublicBookAssets([bad],'a',10)).toThrow();expect(()=>parsePublicBookAssets([a,a],'a',10)).toThrow()})

import {expect,it} from 'vitest'
import {createHash} from 'node:crypto'
import {gzipSync} from 'node:zlib'
import {loadFieldRawRows} from './search_field_raw_rows'
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex')
function fixture(mode='ok'){
 const overlay='a'.repeat(64),parts:any[]=[],strings=['باب العلم','هذا متن 😀 طويل','العلم في الحاشية'],fields=['title','body','foot']
 let raw=Buffer.from('[')
 strings.forEach((s,i)=>{if(i)raw=Buffer.concat([raw,Buffer.from(',')]);const b=Buffer.from(JSON.stringify(s));parts.push([fields[i],raw.length,b.length,sha(b)]);raw=Buffer.concat([raw,b])});raw=Buffer.concat([raw,Buffer.from(']')])
 const sourcePath='/library/shamela/batches/batch-0000/books/9.json'
 const index={contract:'khizana-field-source-ranges-book/1',overlaySha256:overlay,bookId:'9',sourcePath,sourceBytes:raw.length,sourceBookSha256:sha(raw),rows:[['9:0',parts]]}
 const expanded=Buffer.from(JSON.stringify(index)),compressed=gzipSync(expanded)
 const book={bookId:'9',indexFile:'books/9.json.gz',indexBytes:compressed.length,indexSha256:sha(compressed),expandedBytes:expanded.length,sourcePath,sourceBytes:raw.length,sourceBookSha256:sha(raw),documents:1}
 const manifest=Buffer.from(JSON.stringify({contract:'khizana-field-source-ranges/1',overlaySha256:overlay,complete:true,counts:{books:1,documents:1},books:[book]})),requests:string[]=[]
 const fetcher:typeof fetch=async(input,init)=>{
  const path=new URL(String(input)).pathname;requests.push(path)
  if(path.endsWith('/manifest.json'))return new Response(new Uint8Array(manifest))
  if(path.endsWith('.gz'))return new Response(new Uint8Array(compressed))
  expect(path).toBe(sourcePath)
  const match=new Headers(init?.headers).get('Range')?.match(/^bytes=(\d+)-(\d+)$/);expect(match).toBeTruthy()
  const start=Number(match![1]),end=Number(match![2]),bytes=raw.subarray(start,end+1)
  return new Response(new Uint8Array(mode==='corrupt'?Buffer.alloc(bytes.length):bytes),{status:mode==='ignored'?200:206,headers:{'content-range':`bytes ${start}-${end}/${raw.length}`}})
 }
 return {pin:{manifestUrl:'https://fixture.test/fields/manifest.json',manifestSha256:sha(manifest)},overlay,fetcher,requests,strings}
}
it('gets only verified string ranges and preserves exact title/body/foot assembly',async()=>{
 const f=fixture(),reader=await loadFieldRawRows(f.pin,f.overlay,1,1,f.fetcher),row=await reader.row('9:0','foot')
 expect(row.fullText).toBe(f.strings.join('\n\n'));expect(row.fullText.slice(...row.range)).toBe(f.strings[2]);expect(f.requests).toHaveLength(5)
})
it.each(['ignored','corrupt'])('rejects %s source delivery rather than trusting snippets',async mode=>{
 const f=fixture(mode),reader=await loadFieldRawRows(f.pin,f.overlay,1,1,f.fetcher)
 await expect(reader.row('9:0','body')).rejects.toThrow(mode==='ignored'?'field_raw_range_required':'field_raw_checksum')
})

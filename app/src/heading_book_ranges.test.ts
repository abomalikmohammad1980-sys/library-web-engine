import {expect,it} from 'vitest'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {filterHeadingBookRows,validateHeadingBookRanges,type HeadingBookRanges} from './heading_book_ranges'
const ranges:HeadingBookRanges={manifestSha256:'a'.repeat(64),rowCount:7,ranges:[['1',0,2],['2',2,3],['1',5,2]]}
it('keeps ordered matching IDs including nonadjacent ranges without adding rows',()=>{
 validateHeadingBookRanges(ranges,7)
 expect(filterHeadingBookRows([0,2,4,5,6],['1'],ranges)).toEqual([0,5,6])
 expect(filterHeadingBookRows([0,2,4,5,6],['2'],ranges)).toEqual([2,4])
 expect(filterHeadingBookRows([0,2,4,5,6],[],ranges)).toEqual([])
})
it('rejects gaps, overlap and incompatible row counts',()=>{
 for(const value of [{...ranges,rowCount:8},{...ranges,ranges:[['1',0,2],['2',3,4]]},{...ranges,ranges:[['1',0,3],['2',2,5]]}]){
  expect(()=>validateHeadingBookRanges(value as HeadingBookRanges,7)).toThrow('integrity')
 }
})
it('binds generated ownership to both deployed heading manifests',async()=>{
 const data=JSON.parse(await readFile('app/src/heading_book_ranges.generated.json','utf8'))
 const supplement=JSON.parse(await readFile('app/src/heading_catalog_supplement.generated.json','utf8'))
 for(const [kind,path] of [['primary','artifacts/heading-search-central-v2/manifest.json'],['supplement',`app/public/${supplement.baseURL}/manifest.json`]]){
  const raw=await readFile(path!),manifest=JSON.parse(raw.toString())
  validateHeadingBookRanges(data[kind!],manifest.rowCount)
  expect(data[kind!].manifestSha256).toBe(createHash('sha256').update(raw).digest('hex'))
 }
})

import {describe,it,expect} from 'vitest'
import {getSourceEditionBookLink} from './quran_source_book_links'
import data from './quran_source_book_links.generated.json'
describe('original tafsir book destinations',()=>{
 it('opens the proven source page of 2:44, not the shared fragment first page',()=>{
 expect(getSourceEditionBookLink('tahrir-tanwir',2,44)).toEqual({bookId:'410009776',pageIndex:496,sourceRowId:'497',href:'#/reader/410009776?pageIndex=496'})
  expect(getSourceEditionBookLink('ruh-al-maani',2,44)?.pageIndex).toBe(246)
  expect(getSourceEditionBookLink('ibn-juzayy',2,44)?.pageIndex).toBe(77)
  for(const [slug,records] of Object.entries(data.editions)){
   const row=(records as Record<string,unknown>)['2:44']
   if(row)expect(getSourceEditionBookLink(slug,2,44)).toBeDefined()
   else expect(getSourceEditionBookLink(slug,2,44)).toBeUndefined()
  }
 })
 it('has no guessed fallback or cross-verse lookup',()=>{
  expect(getSourceEditionBookLink('missing',2,44)).toBeUndefined()
  expect(getSourceEditionBookLink('__proto__',2,44)).toBeUndefined()
  expect(getSourceEditionBookLink('tahrir-tanwir',2,0)).toBeUndefined()
  expect(getSourceEditionBookLink('tahrir-tanwir',2,44.1)).toBeUndefined()
 })
 it('all destinations are internal existing-book page pointers',()=>{
  for(const [slug,records] of Object.entries(data.editions))for(const [key,record] of Object.entries(records)){
   const [surah,ayah]=key.split(':').map(Number),link=getSourceEditionBookLink(slug,surah!,ayah!)
   expect(link?.href).toBe(`#/reader/${record[0]}?pageIndex=${record[1]}`)
   expect(Number(record[0])).toBeGreaterThan(410000000)
   expect(Number(record[1])).toBeGreaterThanOrEqual(0)
  }
 })
 it('discloses shared sections and preserves an explicit single-verse destination',()=>{
  let sharedFound=false
  for(const [slug,records]of Object.entries(data.editions))for(const [key,row]of Object.entries(records)){
   if(row.length!==5)continue;const [surah,ayah]=key.split(':').map(Number),link=getSourceEditionBookLink(slug,surah!,ayah!)
   expect(link?.method).toBe('explicit-local-verse-toc')
   if(Number(row[3])<Number(row[4])){sharedFound=true;expect(link?.sharedRange).toEqual({surah,from:row[3],to:row[4]})}else expect(link?.sharedRange).toBeUndefined()
  }
  expect(sharedFound).toBe(true)
 })
})

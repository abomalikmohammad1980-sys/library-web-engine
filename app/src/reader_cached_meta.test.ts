import {describe,it,expect} from 'vitest'
import {loadedReaderPageMeta} from './page_meta_model'

describe('metadata from an already resolved reader',()=>{
 it('keeps real book identity offline without indexing position queries',()=>{
  expect(loadedReaderPageMeta('/books/151179?pageIndex=1','التفسير والبيان','عبد العزيز الطريفي')).toMatchObject({
   title:'التفسير والبيان — عبد العزيز الطريفي | الخِزانة',canonicalPath:'/books/151179',robots:'index, follow',
  })
 })
 it('supports approved public upload routes',()=>{
  expect(loadedReaderPageMeta('/books/public/abc-123','كتاب','مؤلف')?.canonicalPath).toBe('/books/public/abc-123')
 })
 it('never promotes private/local or other pages into public SEO',()=>{
  for(const path of ['/books/local/123','/library','/settings','/authors/000020','/books/abc'])
   expect(loadedReaderPageMeta(path,'كتاب','مؤلف')).toBeUndefined()
 })
 it('waits for both real title and author',()=>{
  expect(loadedReaderPageMeta('/books/151179','','مؤلف')).toBeUndefined()
  expect(loadedReaderPageMeta('/books/151179','كتاب',' ')).toBeUndefined()
 })
})

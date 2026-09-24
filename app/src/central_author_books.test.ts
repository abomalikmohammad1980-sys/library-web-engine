import {expect,it} from 'vitest'
import {validateCentralAuthorBookPage,loadAllCentralAuthorBooks} from './central_author_books'
it('accepts explicit published identifiers and empty final page',()=>{expect(validateCentralAuthorBookPage({books:[],page:0,hasMore:false},0)).toEqual([]);expect(validateCentralAuthorBookPage({books:[{id:'source-1',title:'كتاب',owner:'ignored'}],page:0,hasMore:false},0)).toEqual([{id:'source-1',title:'كتاب'}])})
it('rejects repeats, malformed IDs and misleading empty pagination',()=>{for(const books of [[{id:'../private',title:'كتاب'}],[{id:'same',title:'أ'},{id:'same',title:'ب'}]])expect(()=>validateCentralAuthorBookPage({books,page:0,hasMore:false},0)).toThrow();expect(()=>validateCentralAuthorBookPage({books:[],page:0,hasMore:true},0)).toThrow();expect(()=>validateCentralAuthorBookPage({books:[{id:'same',title:'أ'}],page:1,hasMore:false},1,new Set(['same']))).toThrow()})
it('collects later author pages for download without treating the visible page as complete',async()=>{
 const requests:string[]=[]
 const books=await loadAllCentralAuthorBooks('central-author:12345678-1234-4234-8234-123456789abc',new AbortController().signal,async input=>{
  const page=requests.length;requests.push(String(input));return new Response(JSON.stringify({page,hasMore:page===0,books:[{id:'book-'+page,title:'كتاب'}]}),{headers:{'content-type':'application/json'}})
 })
 expect(books.map(b=>b.id)).toEqual(['central-submission:book-0','central-submission:book-1']);expect(requests[1]).toContain('page=1')
})

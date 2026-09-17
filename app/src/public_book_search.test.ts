import {describe,it,expect,vi} from 'vitest'
import {searchPublicBooks,publicBookSearchEnabled} from './public_book_search'
describe('public upload search consumer',()=>{
 it('is disabled without explicit release configuration',()=>expect(publicBookSearchEnabled()).toBe(false))
 it('retains100-row pagination, generation identity and snapshot on laterpages',async()=>{
  const calls:string[]=[];const fetcher=vi.fn(async(input:RequestInfo|URL)=>{const url=String(input);calls.push(url);const p=new URL(url,'https://example.test').searchParams,offset=Number(p.get('offset'));return Response.json({contract:'public-book-search/1',snapshot:'42',totalDocuments:1300,hits:Array.from({length:100},(_,i)=>({bookId:'b',generation:2,field:'body',ordinal:offset+i,title:'كتاب',author:'مؤلف',snippet:'نص',anchor:{paragraphIndex:offset+i}}))})}) as typeof fetch
  const seen=[];for(let offset=0;offset<1300;offset+=100){const page=await searchPublicBooks('نص',{fields:['body'],resultOffset:offset},fetcher);expect(page.totalDocuments).toBe(1300);seen.push(...page.map(h=>h.paraIndex));expect(page[0]?.bookId).toBe('central-submission:b')}
  expect(new Set(seen).size).toBe(1300);expect(calls[1]).toContain('snapshot=42')
 })
 it('never requests public data for a private local-only selection',async()=>{const fetcher=vi.fn();expect(await searchPublicBooks('نص',{fields:['body'],bookIds:['account-book:b']},fetcher)).toHaveLength(0);expect(fetcher).not.toHaveBeenCalled()})
 it('fences stale snapshots and malformed response rather than returning partialsuccess',async()=>{await expect(searchPublicBooks('نص',{fields:['body']},async()=>new Response('',{status:409}))).rejects.toThrow('snapshot_changed');await expect(searchPublicBooks('نص',{fields:['body']},async()=>Response.json({contract:'wrong'}))).rejects.toThrow('invalid_response')})
 it('normalization matches core search and scoped IDs strip only publicalias',async()=>{let url='';await searchPublicBooks('نص',{fields:['heading'],bookIds:['central-submission:abc']},async(input)=>{url=String(input);return Response.json({contract:'public-book-search/1',snapshot:'1',totalDocuments:0,hits:[]})});expect(url).toContain('book=abc')})
})

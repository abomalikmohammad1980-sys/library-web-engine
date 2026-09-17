import {expect,it} from 'vitest'
import {readFileSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {searchFieldTokenSourceRange,searchFieldSourceSnippet} from './search_field_source_snippet'
import {normalizeArabicSearch} from '../../packages/search/src/index'
const source=resolve('../../بيانات-المشروع/shamela/published-corpus-v1/batch-0057/books/21633.json')
const boundary=resolve('.artifacts/field-overlay-full-proof-1789638689620/books/21633.json')
it.skipIf(!existsSync(source)||!existsSync(boundary))('real book 21633 retains original heading tokens and exact footnote positions',()=>{
 const book=JSON.parse(readFileSync(source,'utf8')),rows=JSON.parse(readFileSync(boundary,'utf8')).rows
 for(const [ordinal,page] of book.pages.entries()){
  const title=book.titles.filter((t:any)=>String(t.pageSourceRowId)===String(page.sourceRowId)&&t.title).map((t:any)=>t.title).join('\n\n')
  const text=[title,...[page.body,page.foot].filter(x=>typeof x==='string'&&x.trim())].filter(Boolean).join('\n\n')
  const tuple=rows.find((r:any)=>r[0]===`21633:${page.sequence??ordinal}`)
  const body=searchFieldTokenSourceRange(text,[tuple[1],tuple[2],tuple[3]])
  expect(normalizeArabicSearch(text.slice(...body))).toBe(normalizeArabicSearch(page.body))
  if(page.foot){
   const foot=searchFieldTokenSourceRange(text,[tuple[2],tuple[3],tuple[3]])
   const position=normalizeArabicSearch(text).split(' ').indexOf(normalizeArabicSearch('المخطوط'))
   const hit=searchFieldSourceSnippet(text,foot,position,'المخطوط')
   expect(hit.text).toContain('المخطوط');expect(hit.text).not.toContain('الاستلقاء')
   // Old display-only text lacks the eight independently indexed title tokens.
   expect(()=>searchFieldTokenSourceRange([page.body,page.foot].join('\n\n'),[tuple[1],tuple[2],tuple[3]])).toThrow('search_field_source_token_count')
  }
 }
})

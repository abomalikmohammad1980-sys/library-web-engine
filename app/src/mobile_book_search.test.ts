import {expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
const source=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
it('detaches the compact fixed search sheet from backdrop-filter containment',()=>{
 expect(source('./shell.ts')).toContain("classList.add('app-header--search-open')")
 expect(source('./shell.ts')).toContain("classList.remove('app-header--search-open')")
 expect(source('./shell.ts')).toContain("matchMedia('(max-width: 1100px)')")
 expect(source('./styles/components.css')).toMatch(/\.app-header--search-open\s*\{[^}]*backdrop-filter:none/)
})
it('subject gateway shows book matches inline without starting body search',()=>{
 expect(source('./screens/home.ts')).toContain('attachLiveSearch(filterInput,results,{includeCategory:true,inline:true})')
 expect(source('./live_search.ts')).toContain("renderMessage('جارٍ تحميل اقتراحات الكتب…')")
})
it('large BOK reader avoids whole-body paragraph splitting and DOM text duplication',()=>{
 const reader=source('./screens/reader.ts')
 expect(reader.indexOf("if (format === 'shamela-bok' && stored.bokPages?.length)")).toBeLessThan(reader.indexOf('const paragraphs = textParagraphs(sourceText)'))
 expect(reader).not.toContain('page.dataset.searchText=source.text')
 expect(reader).toContain('readerPageSearchText.set(page,source.text)')
 expect(reader).not.toContain('stored.bokPages?.findIndex(page => page.id === entry.id)')
})

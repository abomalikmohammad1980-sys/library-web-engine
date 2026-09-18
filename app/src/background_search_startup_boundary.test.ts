import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'

it('loads indexing engines only after finding an eligible local revision',()=>{
 const source=readFileSync(new URL('./background_search_index.ts',import.meta.url),'utf8')
 expect(source).not.toMatch(/^import .*from ['"]\.\/engine\/(?:heading_index|search_store)['"]/m)
 const eligible=source.indexOf('if(attempted.has(key)')
 expect(source.indexOf("await import('./engine/heading_index')")).toBeGreaterThan(eligible)
 expect(source.indexOf("await import('./engine/search_store')")).toBeGreaterThan(source.indexOf("if(inferBookFormat(book)!=='pdf')"))
 expect(source).toContain("window.addEventListener('library-changed',schedule)")
})

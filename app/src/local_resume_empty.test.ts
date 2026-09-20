import {expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
it('does not download search/parsing code without pending or imported Word books',()=>{
 const source=readFileSync(new URL('./local_index_status.ts',import.meta.url),'utf8')
 const run=source.slice(source.indexOf('export const resumeImportedWordIndexing='))
 expect(run.indexOf('if(!known.size)return')).toBeGreaterThan(0)
 expect(run.indexOf('if(!known.size)return')).toBeLessThan(run.indexOf("import('./engine/search_store')"))
 expect(run).toContain('for(const book of metadata)known.add(book.id)')
})

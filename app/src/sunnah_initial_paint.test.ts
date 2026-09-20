import {readFileSync} from 'node:fs'
import {it,expect} from 'vitest'
it('does not hold first Sunnah cards/search controls behind chronology enrichment',()=>{
 const source=readFileSync(new URL('./screens/sunnah.ts',import.meta.url),'utf8')
 expect(source).not.toContain('await booksWithAuthorChronology(')
 expect(source).toContain('if(!results.isConnected)return')
 expect(source).toContain('if(!textMode)render()')
 expect(source.indexOf('hadithSearch.onclick=')).toBeLessThan(source.indexOf('void booksWithAuthorChronology('))
})

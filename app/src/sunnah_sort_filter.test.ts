import {expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {sunnahBookMatches,sunnahWindow} from './screens/sunnah'
import {sortBooks} from './book_ordering'
it('applies category and query before deterministic book sorting and paging',()=>{
 const books=[{id:'1',title:'صحيح باء',author:'زيد',category:'الحديث',deathYearHijri:300},{id:'2',title:'صحيح ألف',author:'بكر',category:'الحديث',deathYearHijri:200},{id:'3',title:'صحيح جيم',author:'أحمد',category:'التفسير',deathYearHijri:100}]
 const filtered=books.filter(b=>sunnahBookMatches(b as never,'صحيح','الحديث'))
 expect(sunnahWindow(sortBooks(filtered,'death'),1).map(b=>b.id)).toEqual(['2'])
 expect(sortBooks(filtered,'title').map(b=>b.id)).toEqual(['2','1'])
 expect(filtered).toHaveLength(2)
})
it('resets visible window on order and filter changes and delegates text sorting to the complete-result pager',()=>{
 const source=readFileSync(new URL('./screens/sunnah.ts',import.meta.url),'utf8')
 expect(source).toContain('visibleLimit = SUNNAH_WINDOW_SIZE; render()')
 for(const control of ['order','category'])expect(source).toContain(`${control}.addEventListener('change', resetAndRender)`)
 expect(source).toContain('order.disabled = false')
 expect(source).toContain('orderedTextPage(search.value.trim(),offset,60,order.value as BookSort,controller.signal)')
 expect(source).toContain("if(!page.scopeCoverageComplete)throw Error('sunnah_search_incomplete')")
})

import {expect,it} from 'vitest'
import {searchDocumentPage} from './search_document_page'
it('paginates 100 paragraphs without dropping their repeated occurrences',()=>{
 const hits=Array.from({length:521},(_,i)=>({id:String(Math.floor(i/2)),bookId:'1',paragraphIndex:Math.floor(i/2),text:'نص نص',matchOffset:i%2*3}))
 const full={total:521,hits,coverageComplete:true},first=searchDocumentPage(full,0,100),second=searchDocumentPage(full,100,100),last=searchDocumentPage(full,200,100)
 expect(first.hits).toHaveLength(100);expect(second.hits).toHaveLength(100);expect(last.hits).toHaveLength(61)
 expect(first.total).toBe(521);expect(first.totalDocuments).toBe(261);expect(first.coverageComplete).toBe(true)
 const all=[...first.hits,...second.hits,...last.hits];expect(new Set(all.map(h=>h.id)).size).toBe(261);expect(all.reduce((n,h)=>n+h.occurrenceCount,0)).toBe(521)
 expect(full.hits[0]).not.toHaveProperty('occurrenceCount')
})

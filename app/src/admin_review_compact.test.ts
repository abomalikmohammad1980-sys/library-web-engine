import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
const screen=readFileSync(new URL('./screens/admin_books.ts',import.meta.url),'utf8')
const oversight=readFileSync(new URL('./oversight_panel.ts',import.meta.url),'utf8')
it('separates the quick submission list from the upper review workspace',()=>{
 expect(screen).toContain('admin-review-workspace')
 expect(screen).toContain('rows.filter(row=>!known.has(row.id)).map(quickSubmissionRow)')
 expect(screen).toContain('bookFileLink(book)')
 expect(screen).toContain('admin-review-actions')
 expect(screen).not.toContain('السجل السابق للقراءة')
 expect(oversight).toContain("'aria-label':'متابعة أعمال الإدارة'")
 expect(oversight).toContain("currentAccountClaims()?.role!=='super-admin'")
})
it('groups actor loading with its filter and keeps undo behind details',()=>{
 expect(oversight).toContain('oversight-filters')
 expect(oversight).toContain('actorPicker.append(membersMore)')
 expect(oversight).toContain('oversight-event__undo')
 expect(oversight).toContain("membersMore.hidden=true")
})

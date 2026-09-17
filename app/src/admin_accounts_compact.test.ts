import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('./screens/admin_books.ts',import.meta.url),'utf8')
const css=readFileSync(new URL('./styles/screens.css',import.meta.url),'utf8')
it('replaces account pages instead of appending and exposes numbered navigation',()=>{
 expect(source).toContain("'aria-label':'صفحات الحسابات'")
 expect(source).toContain('loadAccountAdminMembersPage(page,50)')
 expect(source).toContain("'aria-current':index===page?'page':undefined")
 expect(source).not.toContain('accountMembersMore')
 expect(source).toContain('accountMembersGeneration')
})
it('isolates compact identity, metrics and actions and hides secondary management until opened',()=>{
 for(const name of ['admin-account-row','admin-account-row__identity','admin-account-row__counts','admin-account-row__actions'])expect(source).toContain(name)
 expect(source).toContain("h('details'")
 expect(css).toContain('.admin-account-row__header')
})

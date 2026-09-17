import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {hasAccountPermission,isTrustedAccountClaims} from './account_authority'
it('administration no longer hydrates the whole central catalog',()=>{
 const admin=readFileSync(new URL('./screens/admin_books.ts',import.meta.url),'utf8')
 expect(admin).not.toContain('root.append(host); void hydrate(host)')
 expect(admin).toContain('export function publishedBookEditor')
 const book=readFileSync(new URL('./screens/book.ts',import.meta.url),'utf8')
 expect(book).toContain('publishedBookControls(book,editorHost)')
 const controls=readFileSync(new URL('./published_book_controls.ts',import.meta.url),'utf8')
 expect(controls).toContain('publishedBookEditor(book,true)')
 expect(controls).toContain("hasAccountPermission(currentAccountClaims(),'book:edit-published-metadata')")
 expect(controls).toContain("if(!current()||!hasAccountPermission(currentAccountClaims(),'book:edit-published-metadata'))return")
})
it('editor edits metadata but cannot publish reviews, hide, delete or change roles',()=>{
 const claims={subject:'editor',sessionId:'verified',role:'editor' as const}
 expect(isTrustedAccountClaims(claims)).toBe(true)
 expect(hasAccountPermission(claims,'book:edit-published-metadata')).toBe(true)
 expect(hasAccountPermission(claims,'book:edit-published-author')).toBe(true)
 expect(hasAccountPermission(claims,'book:review-submissions')).toBe(false)
 expect(hasAccountPermission(claims,'book:logical-delete-published')).toBe(false)
 expect(hasAccountPermission(claims,'book:edit-published-visibility')).toBe(false)
})

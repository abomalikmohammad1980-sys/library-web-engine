import {h} from './ui'
import {icon} from './icons'
import {currentAccountClaims,hasAccountPermission} from './account_authority'

/** Remove privileged UI from the DOM; CSS display rules cannot reveal it. */
export function createLibraryAdminEntry():{element:HTMLElement;refresh:()=>void}{
 const element=h('div',{class:'library-admin-entry'})
 const refresh=()=>{
  const claims=currentAccountClaims()
  const allowed=hasAccountPermission(claims,'book:review-submissions')||hasAccountPermission(claims,'book:edit-published-metadata')
  element.replaceChildren(...(allowed?[h('a',{class:'btn btn--secondary',href:'#/admin/books'},icon('settings',18),'لوحة الإدارة')]:[]))
 }
 refresh()
 return{element,refresh}
}

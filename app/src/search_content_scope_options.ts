import type {SearchContentScope} from './search_content_scope'
export const SEARCH_CONTENT_SCOPE_OPTIONS:ReadonlyArray<readonly [SearchContentScope,string]>=[
 ['both','الحاشية والمتن معًا'],['body','المتن فقط'],['foot','الحاشية فقط'],
]
export function parseSearchContentScope(value:unknown):SearchContentScope{
 return value==='body'||value==='foot'?value:'both'
}

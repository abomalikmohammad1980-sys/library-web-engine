import {expect,it} from 'vitest'
import {ACCESSIBLE_ROUTES} from './navigation_accessibility'
import {DYNAMIC_TITLE_SELECTORS,SCREEN_OWNED_TITLE_ROUTES,COLLECTION_TITLE_ROUTES} from './dynamic_document_title'
it('classifies every route exactly once, including the source route and book alias',()=>{
 const classified=[...Object.keys(DYNAMIC_TITLE_SELECTORS),...SCREEN_OWNED_TITLE_ROUTES,...COLLECTION_TITLE_ROUTES]
 expect(new Set(classified).size).toBe(classified.length)
 expect(classified.sort()).toEqual([...ACCESSIBLE_ROUTES,'sunnah-source'].sort())
})

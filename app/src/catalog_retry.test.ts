import {expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {catalogRetryDelay} from './catalog_retry'
it('backs off and stops automatic requests during a persistent outage',()=>{
 expect([0,1,2,3,4].map(catalogRetryDelay)).toEqual([3000,15000,60000,undefined,undefined])
})
it('announces only a complete retry and fences the originating identity',()=>{
 const source=readFileSync(new URL('./engine/library_store.ts',import.meta.url),'utf8')
 expect(source).toContain('listBooks({requireCompleteCatalog:true}).then')
 expect(source).toContain("if(scope===currentLibraryIdentityScope())window.dispatchEvent")
 expect(source).not.toContain('},1500)')
})

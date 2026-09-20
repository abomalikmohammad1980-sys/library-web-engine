import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'
const source=readFileSync(new URL('./screens/home.ts',import.meta.url),'utf8')
it('defers each optional home section without removing its markup',()=>{
 for(const [element,hydrate] of [['recent','hydrateRecent'],['newForYou','hydrateNewForYou'],['gateways','hydrateGateways'],['popular','hydratePopular'],['quote','hydrateDailyQuote']]){
  expect(source).toContain(`whenNearViewport(${element}, () => { void ${hydrate}(${element}) })`)
 }
 expect(source).toContain('initialRecent(snapshot)')
 expect(source).toContain('initialNewForYou(snapshot)')
})
it('does not speculatively download author metadata at boot',()=>{
 const boot=readFileSync(new URL('./main.ts',import.meta.url),'utf8')
 expect(boot).not.toContain('loadShamelaAuthorMetadata')
 expect(boot).toContain('ensurePublishedLibrarySeeded()')
 expect(boot).toContain('installBackgroundSearchIndex()')
})

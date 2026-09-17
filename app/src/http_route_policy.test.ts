import {expect,it} from 'vitest'
import {httpRoutePolicy} from './http_route_policy'
import {canonicalizePath,locationRouteHash,legacyHashToPath} from './path_location'
it('redirects old HTTP public identities with the exact reader query preserved',()=>{
 for(const [old,next] of [['/books/shamela-21633','/books/21633'],['/reader/410021633','/books/21633'],['/people/000020','/authors/000020'],['/author/20','/authors/000020']]){
  const query='?pageIndex=4&para=7&q=%D8%B9&x=1&x=2'
  expect(httpRoutePolicy(old!,query)).toEqual({kind:'redirect',path:next+query})
  expect(canonicalizePath(old!+query)).toBe(next+query)
 }
 expect(httpRoutePolicy('/books/shamela-999999999')).toEqual({kind:'redirect',path:'/books/999999999'})
 expect(httpRoutePolicy('/books/999999999')).toEqual({kind:'known'}) // metadata lookup must return404
})
it('unknown route shapes are 404 candidates, not private SPA fallbacks',()=>{
 for(const path of ['/this-does-not-exist-xyz','/settings/unknown','/admin','/admin/unknown','/account/unknown','/quran/nonsense','/sunnah/source/a/extra','/books/local/id/extra','/%ZZ','//evil.test'])expect(httpRoutePolicy(path)).toEqual({kind:'not-found'})
})
it('keeps all published client routes including private and legacy opaque identities',()=>{
 for(const path of ['/','/features','/quran','/quran/tafsir/tabari/2/4','/sunnah','/sunnah/source/x','/authors','/authors/000020','/browse','/new-books','/search','/settings','/me','/library','/shelves','/notes','/account/sign-in','/admin/books','/reading-plans','/research-projects','/editions','/series','/data-quality','/welcome','/quotes','/recommendations','/books/local/account-book%3Aid','/books/public/id','/author/local%3Aperson','/reader/local%3Aid'])expect(httpRoutePolicy(path,'?x=1')).toEqual({kind:'known'})
 expect(locationRouteHash({pathname:'/reader/410021633',search:'?para=2',hash:''})).toBe('#/reader/410021633?para=2')
 expect(legacyHashToPath('#/people/000020')).toBe('/authors/000020')
})

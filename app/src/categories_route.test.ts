import {expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {validRouteShape} from './route_shape'
import {httpRoutePolicy} from './http_route_policy'
import {pageMetaFor,publicPaginationCanonicalPath} from './page_meta_model'
import {publicCategoryHref} from './screens/categories'
it('accepts actual categories routes without weakening unknown-route detection',()=>{
 expect(validRouteShape(['categories'])).toBe(true)
 expect(validRouteShape(['categories',encodeURIComponent('كتب الحديث')])).toBe(true)
 for(const parts of [['categories','x','y'],['categories','%ZZ'],['categories','%2Fsecret']])expect(validRouteShape(parts)).toBe(false)
 expect(httpRoutePolicy('/categories/'+encodeURIComponent('كتب الحديث'))).toEqual({kind:'known'})
 const router=readFileSync(new URL('./router.ts',import.meta.url),'utf8')
 expect(router).toContain("categoriesScreen(route.param)");expect(router).toContain("case 'categories': return import('./screens/categories')")
})
it('indexable category metadata requires loaded public category identity and keeps page canonical',()=>{
 const path='/categories/'+encodeURIComponent('كتب الحديث')
 expect(pageMetaFor('/categories?page=2')).toMatchObject({canonicalPath:'/categories?page=2',robots:'index, follow'})
 expect(pageMetaFor(path)).toMatchObject({robots:'noindex, follow'})
 expect(pageMetaFor(path+'?page=2',{id:'',category:'كتب الحديث'})).toMatchObject({title:'كتب الحديث | الخِزانة',canonicalPath:path+'?page=2',robots:'index, follow'})
 expect(publicPaginationCanonicalPath(path+'?page=1')).toBe(path)
})
it('projects only same-origin public reader/category/author links, never personal-library links or HTML',()=>{
 const origin='https://khzanah.com'
 expect(publicCategoryHref('/books/21633',origin)).toBe('/books/21633')
 expect(publicCategoryHref('/categories?page=2',origin)).toBe('/categories?page=2')
 for(const href of ['https://evil.test/books/1','javascript:alert(1)','/books/local/id','/library','/categories?page=2&page=3','/books/1?token=secret'])expect(publicCategoryHref(href,origin)).toBeUndefined()
 const source=readFileSync(new URL('./screens/categories.ts',import.meta.url),'utf8')
 expect(source).toContain('scope.add(()=>active?.abort())');expect(source).toContain('if(!valid())return')
 expect(source).toContain('size>512000');expect(source).toContain('anchor.textContent');expect(source).not.toContain('innerHTML');expect(source).not.toContain('listBooks')
})

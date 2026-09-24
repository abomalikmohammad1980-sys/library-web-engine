import {afterEach,it,expect,vi} from 'vitest'
import {prepareRouteScroll,routeScrollTarget} from './navigation_scroll'
afterEach(()=>vi.unstubAllGlobals())
it('starts new pages above and keeps explicit browser history restoration',()=>{
 expect(routeScrollTarget('#/authors','#/library',{hash:'#/library',x:0,y:900})).toEqual({x:0,y:0})
 expect(routeScrollTarget('#/authors','#/library',{hash:'#/authors',x:0,y:600})).toEqual({x:0,y:600})
 expect(routeScrollTarget('#/authors','#/authors',null)).toBeUndefined()
})
it('lets the reader restore its own page without forcing layout for every scroll',()=>{
 let scrollListener=()=>{},reads=0
 const route={hash:'#/reader/410000907',pathname:'/books/907',search:''}
 const fakeWindow={addEventListener:(name:string,callback:()=>void)=>{if(name==='scroll')scrollListener=callback},get scrollX(){reads++;return 0},get scrollY(){reads++;return 8497},scrollTo:vi.fn()}
 const fakeHistory={state:{} as Record<string,unknown>,scrollRestoration:'auto',replaceState:vi.fn((state:Record<string,unknown>)=>{fakeHistory.state=state})}
 vi.stubGlobal('window',fakeWindow);vi.stubGlobal('history',fakeHistory);vi.stubGlobal('location',route)
 prepareRouteScroll(route.hash,true)()
 scrollListener()
 expect(reads).toBe(0)
 expect(fakeHistory.replaceState).toHaveBeenCalledTimes(1)
 route.hash='#/authors';route.pathname='/authors'
 prepareRouteScroll(route.hash,false)()
 scrollListener()
 expect(reads).toBeGreaterThan(0)
 expect(fakeHistory.replaceState).toHaveBeenCalledTimes(3)
})

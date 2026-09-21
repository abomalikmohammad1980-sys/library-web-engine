import {expect,it,vi} from 'vitest'
import {fitPageToWidth} from './engine/dom_render'
import {readFileSync} from 'node:fs'

it('text zoom preserves the current page without mounting every distant page',()=>{
 const source=readFileSync(new URL('./screens/reader.ts',import.meta.url),'utf8')
 const body=source.slice(source.indexOf('const refitAllPagesAfterZoom'),source.indexOf("window.addEventListener('scroll', scheduleViewportSync"))
 const text=body.slice(0,body.indexOf('for (let index'))
 expect(text).toContain("classList.contains('reader__text-page')")
 expect(text).toContain('const anchor = activeReaderPageIndex')
 expect(text).toContain('routeAnimationFrame(() => scrollTo(anchor), resourceScope)')
 expect(text).toContain('return')
})

it('text pages use native flow without fixed Word geometry or observers',()=>{
 const appendChild=vi.fn(),wrap={className:'',appendChild}
 const createElement=vi.fn(()=>wrap)
 vi.stubGlobal('document',{createElement})
 const observer=vi.fn(()=>{throw Error('text must not allocate Word observers')})
 vi.stubGlobal('ResizeObserver',observer)
 try{
  const styleRead=vi.fn(()=>({}))
  const page={classList:{contains:(name:string)=>name==='reader__text-page'},get style(){return styleRead()}} as unknown as HTMLElement
  const cleanup=vi.fn()
  expect(fitPageToWidth(page,680,cleanup)).toBe(wrap)
  expect(styleRead).not.toHaveBeenCalled()
  expect(wrap.className).toContain('reading__page--text-flow')
  expect(appendChild).toHaveBeenCalledWith(page)
  expect(observer).not.toHaveBeenCalled();expect(cleanup).not.toHaveBeenCalled()
 }finally{vi.unstubAllGlobals()}
})

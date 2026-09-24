import {afterEach,describe,expect,it,vi} from 'vitest'
import {followHtmlBookAnchor} from './html_book_navigation'

afterEach(()=>vi.unstubAllGlobals())
function fixture(href='#html-book-anchor-1',owned=true){
  const link={getAttribute:()=>href}
  class Origin { closest(){return link} }
  vi.stubGlobal('Element',Origin)
  const target={id:'html-book-anchor-1',scrollIntoView:vi.fn()}
  const preventDefault=vi.fn()
  const event={target:new Origin(),preventDefault} as unknown as MouseEvent
  const container={contains:()=>owned,querySelectorAll:()=>[target]} as unknown as HTMLElement
  return {event,container,target,preventDefault}
}
describe('HTML book fragment navigation',()=>{
  it('scrolls to the book-local anchor and prevents routing',()=>{
    const f=fixture()
    expect(followHtmlBookAnchor(f.event,f.container)).toBe(true)
    expect(f.preventDefault).toHaveBeenCalledOnce()
    expect(f.target.scrollIntoView).toHaveBeenCalledWith({behavior:'auto',block:'center'})
  })
  it('prevents an unresolved imported fragment from changing the route',()=>{
    const f=fixture('#html-book-missing')
    expect(followHtmlBookAnchor(f.event,f.container)).toBe(false)
    expect(f.preventDefault).toHaveBeenCalledOnce()
    expect(f.target.scrollIntoView).not.toHaveBeenCalled()
  })
  it('ignores anchors outside the current reader',()=>{
    const f=fixture(undefined,false)
    expect(followHtmlBookAnchor(f.event,f.container)).toBe(false)
    expect(f.preventDefault).not.toHaveBeenCalled()
  })
  it('ignores non-element click origins',()=>{
    const f=fixture()
    expect(followHtmlBookAnchor({...f.event,target:null} as unknown as MouseEvent,f.container)).toBe(false)
    expect(f.preventDefault).not.toHaveBeenCalled()
  })
})

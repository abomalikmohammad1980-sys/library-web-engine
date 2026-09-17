/** Contain CSS parent/child margin collapse without moving authored content.
 * Mapped pages have an explicit body min-height, so an escaped leading margin
 * can enlarge the paper even when the body text already fits. */
const attempted=new WeakSet<HTMLElement>()
const coordinates=['top','left','width','height'] as const
export function containWordBodyMargins(page:HTMLElement):boolean {
 if(!page.isConnected||attempted.has(page)||page.dataset.wordPaginationSource!=='word-map')return false
 const body=page.querySelector<HTMLElement>(':scope > .page-body')
 if(!body)return false
 const style=getComputedStyle(body)
 if(style.display!=='block'||!['auto','1'].includes(style.columnCount))return false
 const elements=[...body.querySelectorAll<HTMLElement>('*')]
 // Bound synchronous geometry work; complex pages retain their existing path.
 if(!elements.length||elements.length>1200)return false
 attempted.add(page)
 const rects=()=>elements.map(el=>el.getBoundingClientRect())
 const before=rects(),height=page.getBoundingClientRect().height,old=body.style.display
 let accepted=false
 try {
  body.style.display='flow-root'
  const after=rects()
  accepted=before.every((r,i)=>coordinates.every(k=>Math.abs(r[k]-after[i]![k])<=1/64))
    &&page.getBoundingClientRect().height<=height+1/64
  return accepted
 }finally{if(!accepted)body.style.display=old}
}

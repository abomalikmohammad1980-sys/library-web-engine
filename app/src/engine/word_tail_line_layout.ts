import type {BodyParagraph} from '@engine/ooxml-model'
import {shouldShrinkPack} from '@engine/layout'

type CharBox={node:Text;offset:number;top:number;left:number;right:number}
function boxes(el:HTMLElement):CharBox[]{
 const result:CharBox[]=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT)
 let node:Node|null
 while((node=walker.nextNode()))for(let i=0;i<(node as Text).length;i++){
  const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1)
  const r=range.getBoundingClientRect();result.push({node:node as Text,offset:i,top:r.top,left:r.left,right:r.right})
 }
 return result
}
/** Bounded final-line packing. Caller limits use to complete mapped table cells.
 * One attempt; preserves original nodes on rejection, never rewrites text. */
export function tryWordTailLineLayout(el:HTMLElement,p:BodyParagraph,compat:number):boolean{
 if(!el.isConnected||el.dataset.wordTailLayout||p.numbered||!Number.isFinite(compat)||compat<15||p.jc!=='both'||p.anchors?.length||p.indFirstLine||p.excluded==='field'||p.excluded==='drawing'||p.excluded==='sym')return false
 const text=el.textContent??''
 if(!text||text.length>2000||text!==p.runs.map(r=>r.text).join('')||text!==text.trim()||/[\t\n\r\u00a0\u00ad\u0640]/u.test(text)||/  /u.test(text))return false
 if(p.runs.some(r=>r.hidden||r.fieldResult!=null||r.math||r.noteRef||r.noteBodyRef||r.href||r.superscript||r.subscript))return false
 if([...el.querySelectorAll('*')].some(n=>n.tagName!=='SPAN'))return false
 const cs=getComputedStyle(el)
 if(cs.textAlign!=='justify'||!['normal','0px'].includes(cs.wordSpacing))return false
 const width=parseFloat(cs.width)-(cs.boxSizing==='border-box'?parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight)+parseFloat(cs.borderLeftWidth)+parseFloat(cs.borderRightWidth):0)
 if(!Number.isFinite(width)||width<=0)return false
 const originalBoxes=boxes(el),tops=[...new Set(originalBoxes.map(b=>Math.round(b.top*4)))].sort((a,b)=>a-b)
 if(tops.length<3)return false
 const boundary=originalBoxes.findIndex(b=>Math.round(b.top*4)===tops.at(-2))
 if(boundary<=0||text[boundary-1]!==' ')return false
 const tailText=text.slice(boundary),lastSpace=tailText.lastIndexOf(' '),n=tailText.split(' ').length-1
 if(lastSpace<0)return false
 const range=document.createRange();range.selectNodeContents(el)
 const point=originalBoxes[boundary]!
 range.setEnd(point.node,point.offset);const prefix=range.cloneContents()
 range.selectNodeContents(el);range.setStart(point.node,point.offset);const tail=range.cloneContents()
 const probe=document.createElement('div');probe.style.cssText=el.style.cssText
 Object.assign(probe.style,{position:'fixed',visibility:'hidden',display:'block',width:'max-content',margin:'0',padding:'0',border:'0',whiteSpace:'pre',textAlign:'start',font:cs.font,direction:cs.direction,zoom:'1'})
 probe.append(tail.cloneNode(true));document.body.append(probe)
 let full=0,prefixWidth=0,spaceWidth=0
 try{
  full=probe.getBoundingClientRect().width
  const bs=boxes(probe),spaces=bs.filter((_,i)=>tailText[i]===' ')
  spaceWidth=spaces.reduce((s,b)=>s+b.right-b.left,0)/n
  const end=bs[lastSpace]!;const cut=document.createRange();cut.selectNodeContents(probe);cut.setStart(end.node,end.offset);cut.deleteContents()
  prefixWidth=probe.getBoundingClientRect().width
 }finally{probe.remove()}
 if(prefixWidth>width||!shouldShrinkPack(full-width,n,spaceWidth,width,prefixWidth))return false
 const originals=[...el.childNodes],head=document.createElement('span'),last=document.createElement('span')
 Object.assign(head.style,{display:'contents'});head.append(prefix)
 Object.assign(last.style,{display:'inline-block',width:'100%',whiteSpace:'nowrap',textAlign:'start',textAlignLast:'start',wordSpacing:`${-(full-width)/n}px`});last.append(tail)
 el.replaceChildren(head,last)
 let accepted=false
 try{
  const after=boxes(el),rows=new Set(after.map(b=>Math.round(b.top*4)))
  const selected=document.createRange();selected.selectNodeContents(el)
  accepted=el.textContent===text&&selected.toString()===text&&rows.size===tops.length-1&&after.length===originalBoxes.length
  const tailRange=document.createRange();tailRange.selectNodeContents(last)
  const tailBounds=tailRange.getBoundingClientRect(),lineBounds=last.getBoundingClientRect()
  if(tailBounds.left<lineBounds.left-1/64||tailBounds.right>lineBounds.right+1/64)accepted=false
  // Earlier text must remain at the same physical coordinates, not just same row count.
  for(let i=0;accepted&&i<boundary;i++){
   const a=after[i]!,b=originalBoxes[i]!
   if(Math.abs(a.top-b.top)>1/64||Math.abs(a.left-b.left)>1/64||Math.abs(a.right-b.right)>1/64)accepted=false
  }
  if(accepted)el.dataset.wordTailLayout='space-compression'
  return accepted
 }finally{if(!accepted)el.replaceChildren(...originals)}
}

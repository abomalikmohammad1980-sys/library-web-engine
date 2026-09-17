import type {BodyParagraph} from '@engine/ooxml-model'
import {shouldShrinkPack} from '@engine/layout'

/** Bounded single-line Word fitting. One synchronous attempt;
 * no observers, retries, text mutation, or compression of a multiline paragraph. */
export function trySingleLineSmartShrink(el:HTMLElement,p:BodyParagraph,compat:number):boolean{
 if(!el.isConnected||p.anchors?.length)return false
 if(!Number.isFinite(compat)||compat<15||p.jc!=='both'||p.runs.length!==1||el.children.length!==1||p.indFirstLine||p.excluded==='field'||p.excluded==='drawing'||p.excluded==='sym')return false
 const run=p.runs[0]!,span=el.firstElementChild as HTMLElement,text=run.text
 if(run.hidden||run.fieldResult!=null||run.math||run.href||run.noteRef||run.noteBodyRef||run.superscript||run.subscript||span.tagName!=='SPAN'||span.children.length||span.textContent!==text||el.textContent!==text)return false
 if(!text||text!==text.trim()||/[\t\r\n\u00a0\u0640\u00ad]/u.test(text)||/  /u.test(text))return false
 const cs=getComputedStyle(el),rs=getComputedStyle(span)
 if(cs.wordSpacing!=='0px'&&cs.wordSpacing!=='normal')return false
 if(rs.letterSpacing!=='normal'&&rs.letterSpacing!=='0px')return false
 const range=document.createRange();range.selectNodeContents(span)
 const rows=()=>new Set([...range.getClientRects()].filter(r=>r.width>0).map(r=>Math.round(r.top*4))).size
 if(rows()!==2)return false
 // Computed width is in local CSS pixels; bounding rectangles include reader zoom.
 const width=parseFloat(cs.width)-(cs.boxSizing==='border-box'?parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight)+parseFloat(cs.borderLeftWidth)+parseFloat(cs.borderRightWidth):0)
 if(!Number.isFinite(width)||width<=0)return false
 const probe=span.cloneNode(false) as HTMLElement
 probe.style.cssText=span.style.cssText
 Object.assign(probe.style,{position:'fixed',visibility:'hidden',whiteSpace:'pre',width:'max-content',font:rs.font,fontKerning:rs.fontKerning,fontFeatureSettings:rs.fontFeatureSettings,fontVariationSettings:rs.fontVariationSettings,fontVariantLigatures:rs.fontVariantLigatures,textTransform:rs.textTransform,letterSpacing:rs.letterSpacing,wordSpacing:'0px',direction:rs.direction})
 document.body.append(probe)
 try{
  const measure=(s:string)=>{probe.textContent=s;return probe.getBoundingClientRect().width}
  const full=measure(text),cut=text.lastIndexOf(' '),prefix=measure(text.slice(0,cut)),n=text.split(' ').length-1,space=measure(' ')
  if(cut<0||prefix>width||!shouldShrinkPack(full-width,n,space,width,prefix))return false
  const old=span.style.wordSpacing
  span.style.wordSpacing=`${-(full-width)/n}px`
  if(rows()!==1){span.style.wordSpacing=old;return false}
  return true
 }finally{probe.remove()}
}

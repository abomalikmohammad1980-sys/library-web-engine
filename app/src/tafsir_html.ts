import {cleanTafsirHeadingReferences} from './tafsir_verse_excerpt'
/** Presentation only: preserve source words; never accept source HTML attributes. */
export function sanitizedTafsirFragment(value:string,verses:readonly string[]=[]):DocumentFragment {
 const source=new DOMParser().parseFromString(cleanTafsirHeadingReferences(value),'text/html'),output=document.createDocumentFragment()
 const copy=(node:Node,parent:ParentNode):void=>{
  if(node.nodeType===Node.TEXT_NODE){parent.append(document.createTextNode(node.textContent??''));return}
  if(!(node instanceof HTMLElement)||['script','style','iframe','object','template'].includes(node.tagName.toLowerCase()))return
  const tag=node.tagName.toLowerCase(),element=document.createElement(['p','div','br','hr','strong','em','b','i'].includes(tag)?tag:'span')
  if(node.classList.contains('book-ayah'))element.className='quran-tafsir-ayah'
  node.childNodes.forEach(child=>copy(child,element));parent.append(element)
 }
 source.body.childNodes.forEach(node=>copy(node,output))
 markExactVerses(output,verses)
 return output
}

const arabicLetter=(c:string)=>c.replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
const normalized=(value:string)=>Array.from(value).map(arabicLetter).filter(c=>/^[ء-غف-ي]$/.test(c)).join('')
/** Match whole Quran verses, including across harmless inline tags, without changing spelling. */
function markExactVerses(root:DocumentFragment,verses:readonly string[]):void {
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),points:Array<{node:Text;offset:number}>=[]
 let text='',node:Node|null
 while((node=walker.nextNode())){
  const content=node.textContent??''
  for(let i=0;i<content.length;i++){const c=arabicLetter(content[i]!);if(/^[ء-غف-ي]$/.test(c)){text+=c;points.push({node:node as Text,offset:i})}}
 }
 const ranges:Array<{start:number;end:number}>=[]
 for(const verse of new Set(verses.map(normalized).filter(x=>x.length>=12))){
  let start=text.indexOf(verse)
  while(start>=0){const end=start+verse.length;if(!ranges.some(r=>start<r.end&&end>r.start))ranges.push({start,end});start=text.indexOf(verse,end)}
 }
 for(const item of ranges.sort((a,b)=>b.start-a.start)){
  const first=points[item.start]!,last=points[item.end-1]!
  if(first.node.parentElement?.closest('.quran-tafsir-ayah')&&last.node.parentElement?.closest('.quran-tafsir-ayah'))continue
  const range=document.createRange();range.setStart(first.node,first.offset);range.setEnd(last.node,last.offset+1)
  const mark=document.createElement('span');mark.className='quran-tafsir-ayah';mark.append(range.extractContents());range.insertNode(mark)
 }
}

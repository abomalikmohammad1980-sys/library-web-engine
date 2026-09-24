/** Presentation only: do not replace source spelling or assert Quran matching. */
export function ornamentalVerseRanges(text:string):Array<{start:number;end:number}>{
 const ranges:Array<{start:number;end:number}>=[]
 const pattern=/﴿[^﴿﴾]+﴾/gu
 for(const match of text.matchAll(pattern))ranges.push({start:match.index!,end:match.index!+match[0].length})
 return ranges
}

/** Wrap text-node slices without flattening imported emphasis, links or notes. */
export function styleOrnamentalVerses(root:HTMLElement):void{
 const blocks=root.matches('p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote')?[root]:[...root.querySelectorAll<HTMLElement>('p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote')].filter(block=>!block.querySelector('p,li,td,th,blockquote'))
 if(!blocks.length)blocks.push(root)
 for(const block of blocks){
  const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT)
  const nodes:Array<{node:Text;start:number;end:number}>=[];let text='';let current:Node|null
  while((current=walker.nextNode())){
   if(current.parentElement?.closest('script,style,pre,code,.reader__ornamental-verse'))continue
   const value=current.textContent??'';nodes.push({node:current as Text,start:text.length,end:text.length+value.length});text+=value
  }
  const ranges=ornamentalVerseRanges(text)
  for(const {node,start,end} of nodes){
   const hits=ranges.filter(range=>range.start<end&&range.end>start);if(!hits.length)continue
   const fragment=document.createDocumentFragment(),value=node.data;let cursor=0
   for(const range of hits){const from=Math.max(0,range.start-start),to=Math.min(value.length,range.end-start);fragment.append(value.slice(cursor,from));const span=document.createElement('span');span.className='reader__ornamental-verse';span.textContent=value.slice(from,to);fragment.append(span);cursor=to}
   fragment.append(value.slice(cursor));node.replaceWith(fragment)
  }
 }
}

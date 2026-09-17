import {h} from './ui'
export function biographyBlocks(value:string):Array<{kind:'paragraph'|'list';lines:string[]}>{
 const blocks:Array<{kind:'paragraph'|'list';lines:string[]}>=[]
 for(const line of value.replace(/\r\n?/g,'\n').split('\n')){
  if(!line.trim()){if(blocks.at(-1)?.lines.length)blocks.push({kind:'paragraph',lines:[]});continue}
  const list=/^\s*[-*]\s+(.+)$/u.exec(line),kind=list?'list':'paragraph',last=blocks.at(-1)
  if(!last||last.kind!==kind){blocks.push({kind,lines:[list?.[1]??line]})}else last.lines.push(list?.[1]??line)
 }
 return blocks.filter(block=>block.lines.length)
}
function inline(value:string):Array<string|HTMLElement>{
 const result:Array<string|HTMLElement>=[];let offset=0
 for(const match of value.matchAll(/\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/gu)){
  result.push(value.slice(offset,match.index));result.push(h(match[1]?'strong':'em',null,match[1]??match[2]!));offset=match.index!+match[0].length
 }
 result.push(value.slice(offset));return result
}
/** Limited Markdown rendered exclusively through text nodes: no HTML parser. */
export function renderBiographyText(value:string):HTMLElement[]{
 return biographyBlocks(value).map(block=>block.kind==='list'?h('ul',null,...block.lines.map(line=>h('li',null,...inline(line)))):h('p',null,...inline(block.lines.join(' '))))
}

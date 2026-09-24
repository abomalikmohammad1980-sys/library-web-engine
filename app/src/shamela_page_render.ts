import { h } from './ui'
import { textParagraphs } from './text_import'
import { cleanShamelaFootnoteMarks, isShamelaBasmalah, parseTextualFootnoteLine, shamelaSymbolParts, splitTextualFootnoteEntries } from './shamela_text_presentation'
import { styleOrnamentalVerses } from './textual_quran_style'

export interface ShamelaTextBlock { text:string; footnote:boolean; indent:number; separator?:boolean; styleLevel?:number }
export interface TextBlockOptions { footnote?:boolean; indent?:number; basmalah?:boolean }

export function shamelaTextBlocks(text:string,controls:Array<{kind:'separator'|'style';offset:number;level?:number}> = []):ShamelaTextBlock[]{
  for(const control of [...controls].sort((a,b)=>b.offset-a.offset)){const marker=control.kind==='separator'?'\n\uE000separator\n':`\n\uE000style:${control.level??0}\n`;text=text.slice(0,control.offset)+marker+text.slice(control.offset)}
  const normalized=text.replace(/\r\n?/g,'\n')
  const lines=normalized.includes('\n')?normalized.split('\n'):textParagraphs(normalized)
  const blocks:ShamelaTextBlock[]=[]
  let footnoteSection=false,styleLevel:number|undefined
  for(const raw of lines){
    const value=cleanShamelaFootnoteMarks(raw.trim())
    if(!value)continue
    if(value==='\uE000separator'){blocks.push({text:'',footnote:false,indent:0,separator:true});continue}
    if(value.startsWith('\uE000style:')){styleLevel=Number(value.slice(7));continue}
    if(/^(?:[_ـ=-]{3,}|الحواشي\s*:?)$/u.test(value)){footnoteSection=true;continue}
    const explicitFootnote=/^(?:\(\s*\d+\s*\)|\[\s*\d+\s*\]|=)\s*/u.test(value)
    const footnote=footnoteSection||explicitFootnote
    for(const entry of splitTextualFootnoteEntries(value,footnote))blocks.push({text:entry,footnote,indent:0,...styleLevel!=null?{styleLevel}:{}})
  }
  return blocks
}

export function decorateTextParagraph(text:string,options:TextBlockOptions={}):HTMLElement{
  const paragraph=h('p',{class:'reader__text-paragraph'})
  text=cleanShamelaFootnoteMarks(text)
  if(options.indent)paragraph.dataset.indent=String(options.indent)
  if(options.basmalah)paragraph.classList.add('reader__text-basmalah')
  const isNote=options.footnote||/^(?:\[?\d+[\]\).:\-]|الهامش|حاشية)/u.test(text.trim())
  if(isNote)paragraph.classList.add('reader__text-paragraph--note')
  if(/(?:قال رسول الله|عن النبي|صلى الله عليه وسلم|ﷺ)/u.test(text))paragraph.classList.add('reader__text-paragraph--hadith')
  const noteLine=isNote?parseTextualFootnoteLine(text,true):undefined
  const visibleText=noteLine?.body??text
  if(noteLine?.marker)paragraph.appendChild(h('span',{class:'reader__text-note-number','aria-label':`الحاشية ${noteLine.marker}`},`(${noteLine.marker}) `))
  if(noteLine?.continuation)paragraph.classList.add('reader__text-paragraph--note-continuation')
  const content=isNote?h('span',{class:'reader__text-note-body'}):paragraph
  const versePattern=/(\[[^\]\n]{2,40}:\s*[\d٠-٩۰-۹][^\]\n]{0,18}\]|\(\s*(?:[\d٠-٩۰-۹]{1,3}|[*⁎∗]{1,4})\s*\))/gu
  let cursor=0
  for(const match of visibleText.matchAll(versePattern)){
    const start=match.index??0
    if(start>cursor)appendShamelaAccessibleText(content,visibleText.slice(cursor,start))
    const token=match[0]
    content.appendChild(h('span',{class:token.startsWith('[')?'reader__text-verse-ref':'reader__text-note-ref'},token))
    cursor=start+token.length
  }
  if(cursor<visibleText.length)appendShamelaAccessibleText(content,visibleText.slice(cursor))
  if(content!==paragraph)paragraph.appendChild(content)
  styleOrnamentalVerses(paragraph)
  return paragraph
}

function appendShamelaAccessibleText(target:HTMLElement,value:string):void{
  for(const part of shamelaSymbolParts(value)){
    if(!part.label)target.append(document.createTextNode(part.text))
    else target.appendChild(h('span',{class:'reader__text-shamela-symbol','aria-label':part.label,title:part.label},part.text))
  }
}

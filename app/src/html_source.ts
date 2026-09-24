import DOMPurify from 'dompurify'
import {decodeHtmlOriginal} from './html_decode'
import {MAX_HTML_BYTES} from './html_source_limits'
import {safeImportedStyle} from './import_style_security'
import {decorateImportedTextualDom} from './shamela_text_presentation'
import {styleOrnamentalVerses} from './textual_quran_style'
import {staticHtmlQuestionGroups} from './static_html_question_data'
import type {MarkdownAsset} from './engine/library_store'

export {MAX_HTML_BYTES}
export interface HtmlBookDocument {title:string;text:string;content:HTMLElement;headings:Array<{title:string;level:number;bookmark:string}>;assetUrls:string[]}

function companionPath(ref:string):string|undefined{
 if(!ref||/^(?:[a-z][a-z\d+.-]*:|\/|#|\\)/iu.test(ref))return
 let decoded=ref.split(/[?#]/,1)[0]??''
 try{decoded=decodeURIComponent(decoded)}catch{return}
 const parts:string[]=[]
 for(const part of decoded.replace(/\\/gu,'/').split('/')){
  if(!part||part==='.')continue
  if(part==='..'){if(!parts.length)return;parts.pop()}else parts.push(part)
 }
 return parts.join('/')||undefined
}

/** Render inert book markup, never mount the author's document or executable code. */
export function parseHtmlBook(bytes:Uint8Array,fileName:string,assets:MarkdownAsset[]=[]):HtmlBookDocument{
 if(!/\.html?$/i.test(fileName))throw Error('اختر ملف HTML أو HTM')
 const source=decodeHtmlOriginal(bytes)
 const banks=staticHtmlQuestionGroups(source)
 const css:string[]=[]
 const byPath=new Map(assets.filter(asset=>companionPath(asset.path)===asset.path).map(asset=>[asset.path,asset]))
 const imageRefs=new WeakMap<Element,string>()
 const purifier=DOMPurify(window)
 purifier.addHook('uponSanitizeElement',(node)=>{
  if(node.nodeName==='STYLE')css.push(node.textContent??'')
  if(node instanceof Element&&node.nodeName==='LINK'&&node.getAttribute('rel')?.toLowerCase().split(/\s+/u).includes('stylesheet')){
   const asset=byPath.get(companionPath(node.getAttribute('href')??'')??'')
   if(asset?.mimeType==='text/css')css.push(new TextDecoder().decode(asset.data))
  }
 })
 purifier.addHook('uponSanitizeAttribute',(node,data)=>{
  if(node instanceof Element&&node.nodeName==='IMG'&&data.attrName==='src')imageRefs.set(node,data.attrValue)
 })
 const fragment=purifier.sanitize(source,{
  RETURN_DOM_FRAGMENT:true,
  WHOLE_DOCUMENT:true,
  FORBID_TAGS:['script','iframe','object','embed','form','input','button','textarea','select','option','meta','base','link','style','svg','math','video','audio','source'],
  FORBID_ATTR:['src','srcset','poster','background','ping','srcdoc','autofocus','formaction','action','is','slot'],
  ALLOW_DATA_ATTR:false,
 }) as DocumentFragment
 const content=document.createElement('article');content.className='reader__html-content';content.dir='rtl'
 const body=fragment.querySelector('body')
 content.append(...Array.from((body??fragment).childNodes))
 // Generated questionnaires often ship only an empty interactive shell in
 // markup; their literal question bank is rendered below without running JS.
 if(banks.length)for(const shell of content.querySelectorAll<HTMLElement>('.noprint,[style*="display:none"],[style*="display: none"]'))shell.remove()
 // Flatten safe static publisher CSS while original IDs/classes still exist.
 // The sheet is never attached: imports, animation, overlays and remote URLs
 // cannot affect the app. Inline declarations retain their normal precedence.
 const inline=new Map([...content.querySelectorAll<HTMLElement>('[style]')].map(node=>[node,node.getAttribute('style')??'']))
 if(css.reduce((n,value)=>n+value.length,0)>256*1024)throw Error('تنسيقات HTML تتجاوز الحد الآمن')
 let ruleCount=0
 for(const text of css){
  const sheet=new CSSStyleSheet();sheet.replaceSync(text)
  for(const rule of sheet.cssRules){
   if(++ruleCount>2000)throw Error('عدد قواعد تنسيق HTML يتجاوز الحد الآمن')
   if(!(rule instanceof CSSStyleRule))continue
   const declarations=safeImportedStyle(rule.style.cssText)
   if(!declarations)continue
   try{
    for(const selector of rule.selectorText.split(',')){
     const clean=selector.trim()
     const targets=/^(?:html|body|:root)$/.test(clean)?[content]:[...content.querySelectorAll<HTMLElement>(clean.replace(/^(?:html\s+)?body\s+/,'').replace(/^html\s+/,''))]
     for(const target of targets)target.style.cssText+=`;${declarations}`
    }
   }catch{/* An unsupported selector cannot invalidate the book's text. */}
  }
 }
 for(const [node,style] of inline)node.style.cssText+=`;${safeImportedStyle(style)}`
 const ids=new Map<string,string>();let count=0
 for(const element of content.querySelectorAll<HTMLElement>('*')){
  // Imported selectors must not acquire application styling or DOM identities.
  element.removeAttribute('class');element.removeAttribute('name')
  for(const attr of element.getAttributeNames())if(/^on/i.test(attr))element.removeAttribute(attr)
  if(element.hasAttribute('style'))element.setAttribute('style',safeImportedStyle(element.getAttribute('style')??''))
  if(element.id){const old=element.id,id=`html-book-anchor-${++count}`;if(!ids.has(old))ids.set(old,id);element.id=id}
 }
 if(banks.length){
  const bankSection=document.createElement('section');bankSection.className='reader__html-question-bank'
  const bankHeading=document.createElement('h2');bankHeading.textContent='الأسئلة والإجابات';bankSection.append(bankHeading)
  for(const bank of banks){
    const section=document.createElement('section')
    const heading=document.createElement('h3');heading.textContent=bank.title;section.append(heading)
    for(const item of bank.items){
      const paragraph=document.createElement('p')
      const question=document.createElement('strong');question.textContent=item.prompt
      paragraph.append(question)
      if(item.answer){const answer=document.createElement('span');answer.textContent=` — ${item.answer}`;paragraph.append(answer)}
      section.append(paragraph)
    }
    bankSection.append(section)
  }
  content.append(bankSection)
 }
 const headings:Array<{title:string;level:number;bookmark:string}>=[]
 for(const heading of content.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')){
  heading.id||=`html-book-heading-${++count}`
  headings.push({title:heading.textContent?.trim()??'',level:Number(heading.tagName[1]),bookmark:heading.id})
 }
 for(const link of content.querySelectorAll<HTMLAnchorElement>('a[href]')){
  const href=link.getAttribute('href')??''
  if(href.startsWith('#')){let target=href.slice(1);try{target=decodeURIComponent(target)}catch{}const id=ids.get(target);if(id)link.setAttribute('href',`#${id}`);else link.removeAttribute('href')}
  else if(/^https?:\/\//i.test(href)){link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer'}
  else link.removeAttribute('href')
 }
 // src was forbidden during sanitization. Attach only reviewed local object URLs
 // after the inert fragment is complete; never let imported markup issue a fetch.
 const assetUrls:string[]=[],imageUrls=new Map<MarkdownAsset,string>()
 for(const image of content.querySelectorAll('img')){
  const path=companionPath(imageRefs.get(image)??''),asset=path?byPath.get(path):undefined
  if(asset&&/^image\/(?:png|jpeg|gif|webp|avif)$/u.test(asset.mimeType)){
   let url=imageUrls.get(asset)
   if(!url){url=URL.createObjectURL(new Blob([new Uint8Array(asset.data).buffer],{type:asset.mimeType}));imageUrls.set(asset,url);assetUrls.push(url)}
   image.src=url
  }else{const alternative=document.createElement('span');alternative.textContent=image.alt?`[${image.alt}]`:'[صورة مرفقة غير متاحة]';image.replaceWith(alternative)}
 }
 decorateImportedTextualDom(content);styleOrnamentalVerses(content)
 const searchable=content.cloneNode(true) as HTMLElement
 for(const br of searchable.querySelectorAll('br'))br.replaceWith('\n')
 for(const block of searchable.querySelectorAll('p,div,section,article,li,tr,h1,h2,h3,h4,h5,h6,blockquote,pre'))block.append('\n\n')
 const text=(searchable.textContent??'').replace(/[\t ]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim()
 if(!text){assetUrls.forEach(url=>URL.revokeObjectURL(url));throw Error('ملف HTML لا يحتوي نصًا مقروءًا')}
 return {title:headings[0]?.title||fileName.replace(/\.html?$/i,''),text,content,headings,assetUrls}
}

import {h} from './ui'
import {uiTemplateText,uiTemplateAttribute} from './ui_template_binding'
import {appendSearchTextRanges,cleanSearchText,searchCopyText} from './search_presentation'
import {openTranslationDialog} from './translation'
import {buildRichClipboard,writeRichClipboard} from './rich_clipboard'
import {toast} from './ui'
import {icon} from './icons'
import {styleOrnamentalVerses} from './textual_quran_style'
import {captureReadingIdentity} from './reading_identity_scope'
import {shamelaTextBlocks,decorateTextParagraph} from './shamela_page_render'
import {isShamelaBasmalah} from './shamela_text_presentation'
export const searchBookStartHref=(href:string)=>`${href.split('?')[0]}?pageIndex=0`

export interface SearchTableRow {key:string;ordinal:number;bookId?:string;pageIndex?:number;bookTitle:string;authorName:string;deathYearHijri?:number;categoryName?:string;snippet:string;fullText?:string;matchOffset?:number;sectionHeading?:string;partLabel?:string;pageLabel?:string;href:string;occurrenceCount?:number}
export type SearchTableFacet = { kind:'author'|'category'|'death'; value:string|number }
// يحمي العقد القديم بقاء النص الكامل في المعاينة: return{...row,snippet,...(fullText?{fullText}:{})}

export function searchResultsTable(rows:readonly SearchTableRow[],query:string,onFacet?:(facet:SearchTableFacet)=>void):HTMLElement{
  rows=rows.map(row=>{const rawFullText=row.fullText,fullText=rawFullText?cleanSearchText(rawFullText).text:undefined,snippet=cleanSearchText(row.snippet).text,matchOffset=row.matchOffset==null?undefined:cleanSearchText((rawFullText??row.snippet).slice(0,Math.max(0,row.matchOffset))).text.length,unknownAuthor=!row.authorName.trim()||row.authorName==='-'||row.authorName==='مؤلف غير موثق',normalized={...row,authorName:unknownAuthor?'المؤلف مجهول':row.authorName};if(unknownAuthor)delete normalized.deathYearHijri;return{...normalized,snippet,...(fullText?{fullText}:{}),...(matchOffset!=null?{matchOffset}:{})}})
  const table=h('div',{class:'search-results-table search-results-table--compact',role:'table','aria-label':'جدول مواضع البحث'})
  table.append(h('div',{class:'search-results-table__head',role:'row'},...['م','الكتاب','المؤلف ووفاته','النص المميز','الباب','الجزء / الصفحة'].map(label=>h('span',{role:'columnheader'},label==='م'?uiTemplateText('search-ordinal-heading',{}):label))))
  const body=h('div',{class:'search-results-table__body',role:'rowgroup'})
  const backdrop=h('div',{class:'search-workspace__backdrop',hidden:true})
  const preview=h('aside',{class:'search-workspace__preview',role:'dialog','aria-modal':'true','aria-label':'نص موضع نتيجة البحث',hidden:true})
  let hoverTimer:number|undefined,popover:HTMLElement|undefined
  const clearHover=()=>{window.clearTimeout(hoverTimer);popover?.remove();popover=undefined}
  let selected=0,returnFocus:HTMLElement|null=null,previewVersion=0
  const close=()=>{previewVersion++;preview.hidden=true;backdrop.hidden=true;preview.replaceChildren();backdrop.remove();preview.remove();returnFocus?.focus()}
  backdrop.addEventListener('click',close)
  const show=(index:number,focus=true,pageOverride?:SearchTableRow,totalPages?:number)=>{
    const version=++previewVersion
    selected=Math.max(0,Math.min(rows.length-1,index));const row=pageOverride??rows[selected];if(!row)return
    clearHover();if(!backdrop.isConnected)document.body.append(backdrop,preview);backdrop.hidden=false;preview.hidden=false
    const text=h('div',{class:'search-workspace__preview-text reader--textual',tabindex:0,dataset:{noTranslate:'true'}})
    const citationLocation=[row.partLabel?`الجزء ${row.partLabel}`:'',row.pageLabel?`الصفحة ${row.pageLabel}`:''].filter(Boolean).join('، ')
    const source=[row.bookTitle,citationLocation,row.authorName].filter(Boolean).join(' — ')
    const titleLink=h('a',{class:'search-workspace__preview-book',href:searchBookStartHref(row.href),target:'_blank',rel:'noopener',dataset:{noTranslate:'true'}},row.bookTitle) as HTMLAnchorElement
    const authorLink=h('a',{class:'search-workspace__preview-author',href:`#/authors?name=${encodeURIComponent(row.authorName)}`,target:'_blank',rel:'noopener',dataset:{noTranslate:'true'}},row.authorName)
    const sourceMeta=h('p',null,authorLink,...(row.deathYearHijri!=null?[uiTemplateText('search-preview-death',{p1:row.deathYearHijri})]:[]),...(row.sectionHeading?[' · ',h('span',{dataset:{noTranslate:'true'}},row.sectionHeading)]:[]),...(row.partLabel?[' · ',uiTemplateText('search-preview-volume',{p1:row.partLabel})]:[]),...(row.pageLabel?[row.partLabel?'، ':' · ',uiTemplateText('search-preview-page',{p1:row.pageLabel})]:[]))
    renderSearchPreviewPage(text,row.fullText??row.snippet,query)
    const pageNavigation=h('nav',{'aria-label':'التنقل بين صفحات الكتاب'})
    if(row.bookId&&row.pageIndex!=null){
      const pageStatus=h('span',{role:'status','aria-live':'polite'},'صفحات الكتاب')
      let loading=false
      const navigate=async(delta:number)=>{
        if(loading)return
        const identity=captureReadingIdentity();loading=true;pageStatus.textContent='جارٍ تحميل الصفحة…'
        try{
          const {loadPreviewBook,previewBookPage}=await import('./search_preview_pages')
          const book=await loadPreviewBook(row.bookId!)
          if(version!==previewVersion||!identity.isCurrent()||!preview.isConnected)return
          const page=previewBookPage(book,row.pageIndex!+delta)
          if(!page){pageStatus.textContent='وصلت إلى حد الكتاب.';return}
          const href=`${row.href.split('?')[0]}?pageIndex=${page.index}`
          const nextRow={...row,href,pageIndex:page.index,partLabel:page.partLabel,pageLabel:page.pageLabel,fullText:page.text,snippet:page.text}
          delete nextRow.sectionHeading
          show(selected,false,nextRow,page.total)
        }catch(error){if(version===previewVersion&&identity.isCurrent())pageStatus.textContent=error instanceof Error?error.message:'تعذّر تحميل الصفحة.'}
        finally{loading=false}
      }
      pageNavigation.append(h('button',{type:'button',title:'الصفحة السابقة من الكتاب','aria-label':'الصفحة السابقة من الكتاب',disabled:row.pageIndex===0,onclick:()=>void navigate(-1)},icon('chevron-right',22)),pageStatus,h('button',{type:'button',title:'الصفحة التالية من الكتاب','aria-label':'الصفحة التالية من الكتاب',disabled:totalPages!=null&&row.pageIndex>=totalPages-1,onclick:()=>void navigate(1)},icon('chevron-left',22)))
    }
    preview.replaceChildren(
      h('header',null,h('div',{class:'search-workspace__preview-source'},titleLink,sourceMeta),h('a',{class:'btn btn--secondary',href:row.href,target:'_blank',rel:'noopener',title:'فتح الموضع في المكتبة','aria-label':'فتح الموضع في المكتبة'},icon('book',24))),
      text,
      ...(pageNavigation.childElementCount?[pageNavigation]:[]),
      h('nav',{'aria-label':'التنقل بين النتائج'},h('button',{type:'button',class:'btn btn--secondary',onclick:close},'إغلاق المعاينة'),...([['الأول',0,'chevron-right'],['السابق',selected-1,'chevron-right'],['التالي',selected+1,'chevron-left'],['الأخير',rows.length-1,'chevron-left']] as const).map(([label,target,glyph],position)=>h('button',{type:'button',title:`${label} من فقرات نتائج البحث`,'aria-label':`${label} من فقرات نتائج البحث`,disabled:target<0||target>=rows.length||target===selected,onclick:()=>show(target,false)},...(position===0||position===3?[icon(glyph,18),icon(glyph,18)]:[icon(glyph,22)])))),
    )
    installSelectionTools(preview,text,source);if(focus)titleLink.focus()
  }
  // The caller owns pagination. A second slice here silently drops valid rows.
  body.append(...rows.map((row,rowIndex)=>{
    const completeText=row.fullText??row.snippet,excerpt=centerSearchExcerpt(completeText,query,220,row.matchOffset)
    const snippet=h('span',{class:'search-results-table__snippet',role:'cell',title:completeText,'aria-label':excerpt}),snippetText=h('span',{dataset:{noTranslate:'true'}});highlight(snippetText,excerpt,query);snippet.append(snippetText)
    if((row.occurrenceCount??1)>1)snippet.append(h('small',{class:'search-results-table__occurrences'},uiTemplateText('search-occurrences',{p1:row.occurrenceCount!})))
    const author=`${row.authorName}${row.deathYearHijri!=null?` (${row.deathYearHijri} هـ)`:''}`,location=formatResultLocation(row)
    const facetButton=(label:string,facet:SearchTableFacet)=>h('button',{type:'button',class:'search-results-table__facet',onclick:(event:Event)=>{event.preventDefault();event.stopPropagation();onFacet?.(facet)}},label)
    const authorCell=h('span',{role:'cell',dataset:{noTranslate:'true'},title:author,'aria-label':author},facetButton(row.authorName,{kind:'author',value:row.authorName}),...(row.deathYearHijri!=null?[facetButton(`(${row.deathYearHijri} هـ)`,{kind:'death',value:row.deathYearHijri})]:[]),...(row.categoryName?[facetButton(row.categoryName,{kind:'category',value:row.categoryName})]:[]))
const redundantSection=!row.sectionHeading||cleanSearchText(row.sectionHeading).text.trim()===completeText.trim()
const sectionCell=h('span',{role:'cell',class:`search-results-table__section${redundantSection?' search-results-table__section--redundant':''}`},h('span',{class:'search-results-table__mobile-label'},'الباب:'),h('span',{class:'search-results-table__section-text',dataset:{noTranslate:'true'},title:row.sectionHeading??'','aria-label':row.sectionHeading??'—'},row.sectionHeading||'—'))
    const resultRow=h('div',{class:'search-results-table__row',role:'row',tabindex:0,dataset:{resultKey:row.key},onclick:(event:Event)=>{if((event.target as Element).closest('a,button'))return;event.preventDefault();returnFocus=resultRow;show(rowIndex)}},h('span',{role:'cell',title:String(row.ordinal)},String(row.ordinal)),h('a',{role:'cell',dataset:{noTranslate:'true'},href:searchBookStartHref(row.href),target:'_blank',rel:'noopener',title:row.bookTitle,'aria-label':`فتح ${row.bookTitle}`},row.bookTitle),authorCell,snippet,sectionCell,h('span',{class:'search-results-table__location',role:'cell',title:location,'aria-label':location||'الموضع غير متاح'},h('span',{class:'search-results-table__mobile-label'},'الجزء / الصفحة:'),h('span',null,location||'—')))
    resultRow.addEventListener('keydown',event=>{if(event.target!==resultRow)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();returnFocus=resultRow;show(rowIndex)}})
    const previewButton=h('button',{type:'button',class:'search-results-table__preview-button','aria-label':`معاينة النتيجة ${row.ordinal}`,onclick:()=>{returnFocus=previewButton;show(rowIndex)}},'معاينة النص')
    uiTemplateAttribute(previewButton,'aria-label','search-preview-result',{p1:row.ordinal})
    resultRow.querySelector('.search-results-table__location')?.append(previewButton)
    const hover=(target:HTMLElement,kind:'book'|'author'|'text')=>{clearHover();hoverTimer=window.setTimeout(()=>{const rect=target.getBoundingClientRect(),content=kind==='book'?[h('strong',null,row.bookTitle),h('span',null,author)]:kind==='author'?[h('strong',null,author),h('span',null,row.bookTitle)]:[h('p',null,row.fullText??row.snippet)];popover=h('div',{class:`search-workspace__hover search-workspace__hover--${kind}`,role:'tooltip',dataset:{noTranslate:'true'}},...content);document.body.append(popover);const box=popover.getBoundingClientRect(),top=rect.top-box.height-8>=8?rect.top-box.height-8:Math.min(innerHeight-box.height-8,rect.bottom+8),left=Math.max(8,Math.min(innerWidth-box.width-8,rect.left+rect.width/2-box.width/2));popover.style.top=`${top}px`;popover.style.left=`${left}px`},220)}
    const cells=[...resultRow.children] as HTMLElement[];if(matchMedia('(hover: hover) and (pointer: fine)').matches){cells[1]?.addEventListener('mouseenter',()=>hover(cells[1]!,'book'));cells[2]?.addEventListener('mouseenter',()=>hover(cells[2]!,'author'));cells[3]?.addEventListener('mouseenter',()=>hover(cells[3]!,'text'))}resultRow.addEventListener('mouseleave',clearHover)
    return resultRow
  }))
  const onDocumentKeydown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!preview.hidden)close()}
  preview.addEventListener('click',event=>event.stopPropagation());document.addEventListener('keydown',onDocumentKeydown);table.append(body);const cleanupObserver=new MutationObserver(()=>{if(!table.isConnected){clearHover();backdrop.remove();preview.remove();document.removeEventListener('keydown',onDocumentKeydown);cleanupObserver.disconnect()}});cleanupObserver.observe(document.body,{childList:true,subtree:true});return table
}

export function formatResultLocation(row:Pick<SearchTableRow,'partLabel'|'pageLabel'>):string{return[row.partLabel??'',row.pageLabel??''].filter(Boolean).join(' / ')}

/** Keeps the compact table row centred on the actual match; the modal still owns the complete text. */
export function centerSearchExcerpt(text:string,query:string,maxLength=220,matchOffset?:number):string{
  const source=foldWithMap(text),wanted=foldWithMap(query).value
  const supplied=matchOffset==null?undefined:Math.max(0,Math.min(text.length,Math.trunc(matchOffset)))
  let match:number
  if(supplied==null)match=wanted?source.value.indexOf(wanted):-1
  else{const suppliedFolded=source.map.findIndex(original=>original>=supplied);match=Math.max(0,suppliedFolded<0?source.value.length:suppliedFolded)}
  if(match<0||text.length<=maxLength)return text
  const matchStart=source.map[match]??0,matchEnd=(source.map[match+wanted.length-1]??matchStart)+1
  const matchLength=Math.max(1,matchEnd-matchStart),context=Math.max(0,maxLength-matchLength),before=Math.floor(context/2)
  let start=Math.max(0,matchStart-before),end=Math.min(text.length,start+maxLength)
  start=Math.max(0,end-maxLength)
  if(start>0){const boundary=text.indexOf(' ',start);if(boundary>=0&&boundary<matchStart)start=boundary+1}
  if(end<text.length){const boundary=text.lastIndexOf(' ',end);if(boundary>matchEnd)end=boundary}
  return`${start>0?'… ':''}${text.slice(start,end).trim()}${end<text.length?' …':''}`
}

function installSelectionTools(preview:HTMLElement,textRoot:HTMLElement,source:string):void{const hide=()=>preview.querySelector('.reader__selection-menu')?.remove();const show=()=>{const selection=getSelection(),selected=selection?.toString()??'',value=searchCopyText(selected),anchor=selection?.anchorNode;if(!value||!anchor||!textRoot.contains(anchor)||!selection?.rangeCount){hide();return}const range=selection.getRangeAt(0).cloneRange(),rect=range.getBoundingClientRect();hide();const menu=h('div',{class:'reader__selection-menu',role:'toolbar','aria-label':'أدوات النص المحدد'}),done=()=>{hide();selection.removeAllRanges()},action=(label:string,run:()=>void)=>{const button=h('button',{type:'button',onclick:run},label);button.addEventListener('pointerdown',event=>event.preventDefault());return button};menu.append(action('نسخ',()=>void navigator.clipboard.writeText(value).then(()=>{done();toast('نُسخ النص')})),action('نسخ موثّق',()=>void writeRichClipboard(buildRichClipboard(value,source)).then(()=>{done();toast('نُسخ النص مع توثيقه')})),action('ترجمة',()=>{done();openTranslationDialog(value)}),action('في الخِزانة',()=>{window.open(new URL(`#/search?q=${encodeURIComponent(value)}&mode=exact`,location.href).href,'_blank','noopener,noreferrer');done()}),action('في Google',()=>{window.open(`https://www.google.com/search?q=${encodeURIComponent(value)}`,'_blank','noopener,noreferrer');done()}));menu.style.insetInlineStart=`${Math.max(8,Math.min(innerWidth-Math.min(620,innerWidth-16),rect.left+rect.width/2-260))}px`;menu.style.insetBlockStart=`${Math.max(70,rect.top-52)}px`;preview.append(menu)};textRoot.addEventListener('pointerup',()=>requestAnimationFrame(show));textRoot.addEventListener('keyup',event=>{if(event.key.startsWith('Arrow')||event.key==='Shift')requestAnimationFrame(show)})}
export function searchMatchRanges(text:string,query:string):Array<{start:number;end:number}>{const source=foldWithMap(text),wanted=foldWithMap(query).value,ranges:Array<{start:number;end:number}>=[];if(!wanted)return ranges;let match=source.value.indexOf(wanted);while(match>=0){const start=source.map[match]??0,end=(source.map[match+wanted.length-1]??start)+1;ranges.push({start,end});match=source.value.indexOf(wanted,match+wanted.length)}return ranges}
// Important: do not restore the old per-slice call
// appendSearchTextSegment(target,text.slice(cursor,start)); it re-detects a second
// footnote boundary after every highlighted match.
function highlight(target:HTMLElement,text:string,query:string):void{appendSearchTextRanges(target,text,searchMatchRanges(text,query));styleOrnamentalVerses(target)}
/** معاينة الصفحة تستخدم بنية متن/حاشية القارئ نفسها، لا كتلة pre-wrap واحدة. */
export function renderSearchPreviewPage(target:HTMLElement,source:string,query:string):void{
  const page=h('section',{class:'page reader__text-page reader__text-page--bok','aria-label':'صفحة الكتاب'})
  let notes:HTMLElement|undefined
  for(const block of shamelaTextBlocks(source)){
    if(block.separator){page.appendChild(h('hr',{class:'reader__layer-separator','aria-hidden':'true'}));continue}
    if(block.footnote&&!notes){
      notes=h('section',{class:'reader__text-notes','aria-label':'حواشي الصفحة'},h('hr',{class:'reader__text-footnote-rule','aria-hidden':'true'}))
      page.appendChild(notes)
    }
    const paragraph=decorateTextParagraph(block.text,{footnote:block.footnote,indent:block.indent,basmalah:!block.footnote&&isShamelaBasmalah(block.text)})
    if(block.styleLevel!=null){paragraph.classList.add('reader__layered-text');paragraph.dataset.layer=String(block.styleLevel)}
    ;(block.footnote?notes!:page).appendChild(paragraph)
  }
  if(!page.childElementCount)page.appendChild(decorateTextParagraph(source))
  highlightPreviewText(page,query)
  target.replaceChildren(page)
}
function highlightPreviewText(root:HTMLElement,query:string):void{
  if(!query.trim())return
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT)
  const nodes:Text[]=[]
  while(walker.nextNode()){
    const node=walker.currentNode as Text
    if(!node.parentElement?.closest('.reader__text-note-number,.reader__text-note-ref,.reader__text-verse-ref'))nodes.push(node)
  }
  for(const node of nodes){
    const ranges=searchMatchRanges(node.data,query)
    if(!ranges.length)continue
    const fragment=document.createDocumentFragment();let cursor=0
    for(const range of ranges){
      if(range.start>cursor)fragment.append(document.createTextNode(node.data.slice(cursor,range.start)))
      const mark=document.createElement('mark');mark.textContent=node.data.slice(range.start,range.end);fragment.append(mark);cursor=range.end
    }
    if(cursor<node.data.length)fragment.append(document.createTextNode(node.data.slice(cursor)))
    node.replaceWith(fragment)
  }
}
function foldWithMap(text:string):{value:string;map:number[]}{let value='',previousSpace=false;const map:number[]=[];for(let index=0;index<text.length;index++){const normalized=/\s/u.test(text[index]??'')?' ':(text[index]??'').normalize('NFD').replace(/[\u064b-\u065f\u0670]/gu,'').replace(/[أإآٱ]/gu,'ا').replace(/ى/gu,'ي');for(const char of normalized){if(char===' '){if(previousSpace||!value)continue;previousSpace=true}else previousSpace=false;value+=char;map.push(index)}}if(value.endsWith(' ')){value=value.slice(0,-1);map.pop()}return{value,map}}

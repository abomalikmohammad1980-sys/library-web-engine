import { PDFDocument, PDFHexString, PDFName, PDFNumber, type PDFPage, type PDFRef } from 'pdf-lib'
import type { StoredBook } from './engine/library_store'

const PDF_WIDTH=595.28, PDF_HEIGHT=841.89, CANVAS_WIDTH=1240, CANVAS_HEIGHT=1754, PAGE_MARGIN=118, BODY_TOP=190, BODY_BOTTOM=1535
const SITE='www.khzanah.com', FOOTER='الخزانة - نسخة مصدرة آليا'
export const FORMATTED_PDF_BRAND_ASSET='/brand-logo-color.png'
export const FORMATTED_PDF_FONT_ASSET='/fonts/adwa-assalaf.ttf'
let pdfFontReady:Promise<void>|undefined
export function loadFormattedPdfFont():Promise<void>{
  if(!pdfFontReady)pdfFontReady=(async()=>{const font=new FontFace('Khizana PDF Text',`url("${FORMATTED_PDF_FONT_ASSET}")`,{weight:'400',style:'normal'});await font.load();document.fonts.add(font)})().catch(error=>{pdfFontReady=undefined;throw error})
  return pdfFontReady
}
export interface FormattedBookPage { text:string; sourceLabel?:string; sourceId?:number; sourceTextStart?:number; sourceTextEnd?:number }
type PdfBook=Pick<StoredBook,'title'|'author'|'category'|'bokPages'|'bokToc'|'extractedText'>&Partial<Pick<StoredBook,'id'|'sourceKind'|'sourceBookId'|'managedSource'|'sourceFormat'|'data'|'fileName'|'textToc'>>

export interface FormattedPdfLine { text:string; lastInParagraph:boolean }
export interface FormattedPdfTextRun { text:string; footnoteMarker:boolean }

export function isFormattedPdfFootnoteDivider(value:string):boolean{return /^_{4,}$/u.test(value.trim())}
export function formattedPdfTextRuns(value:string,inFootnoteSection=false):FormattedPdfTextRun[]{
  const marker=inFootnoteSection?/^\s*\((?:¬\s*)?([0-9٠-٩۰-۹]+)\)/gu:/\(¬\s*([0-9٠-٩۰-۹]+)\)/gu
  const runs:FormattedPdfTextRun[]=[];let offset=0
  for(const match of value.matchAll(marker)){const index=match.index??0;if(index>offset)runs.push({text:value.slice(offset,index),footnoteMarker:false});runs.push({text:`(${match[1]})`,footnoteMarker:!inFootnoteSection});offset=index+match[0].length}
  if(offset<value.length)runs.push({text:value.slice(offset),footnoteMarker:false})
  return runs.length?runs:[{text:value,footnoteMarker:false}]
}

export function formattedSourcePageLabel(part:number|undefined,page:number|undefined):string|undefined{
  const printedPart=Number.isFinite(part)&&Number(part)>0?Math.trunc(Number(part)):undefined
  const printedPage=Number.isFinite(page)&&Number(page)>0?Math.trunc(Number(page)):undefined
  if(printedPart!=null&&printedPage!=null)return`(${printedPart} / ${printedPage})`
  if(printedPage!=null)return`(${printedPage})`
  return undefined
}

export function formattedBookSourcePages(book:Pick<StoredBook,'bokPages'|'extractedText'>):FormattedBookPage[]{
  if(book.bokPages?.length)return book.bokPages.map(page=>{const sourceLabel=formattedSourcePageLabel(page.part,page.page);return{text:page.text.trim(),sourceId:page.id,...(sourceLabel?{sourceLabel}:{})}})
  const text=book.extractedText?.trim()??'';if(!text)return[];const chunks:FormattedBookPage[]=[]
  for(let offset=0;offset<text.length;){let end=Math.min(text.length,offset+3600);if(end<text.length){const boundary=Math.max(text.lastIndexOf('\n',end),text.lastIndexOf(' ',end));if(boundary>offset+1800)end=boundary}const raw=text.slice(offset,end),value=raw.trim(),start=offset+Math.max(0,raw.search(/\S/u));chunks.push({text:value,sourceTextStart:start,sourceTextEnd:start+value.length});offset=end}return chunks.filter(page=>page.text)
}
export function formattedBookOutlineTargets(book:Pick<PdfBook,'bokPages'|'bokToc'|'extractedText'|'textToc'>,pages=formattedBookSourcePages(book)):Array<{title:string;level:number;pageIndex:number}>{
  if(book.bokPages?.length){const indices=new Map<number,number>();pages.forEach((page,index)=>{if(page.sourceId!=null&&!indices.has(page.sourceId))indices.set(page.sourceId,index)});return(book.bokToc??[]).flatMap(entry=>{const pageIndex=indices.get(entry.id);return pageIndex===undefined?[]:[{title:entry.title,level:entry.level,pageIndex}]})}
  const text=book.extractedText?.trim()??'',starts:number[]=[]
  let start=0
  const addParagraph=(end:number)=>{const raw=text.slice(start,end);if(raw.trim())starts.push(start+raw.search(/\S/u))}
  for(const separator of text.matchAll(/\n{2,}/g)){addParagraph(separator.index!);start=separator.index!+separator[0].length}
  addParagraph(text.length)
  return(book.textToc??[]).flatMap(entry=>{if(!Number.isSafeInteger(entry.paragraphIndex)||entry.paragraphIndex<0)return[];const offset=starts[entry.paragraphIndex];if(offset===undefined)return[];const pageIndex=pages.findIndex(page=>page.sourceTextStart!==undefined&&page.sourceTextEnd!==undefined&&offset>=page.sourceTextStart&&offset<page.sourceTextEnd);return pageIndex<0?[]:[{title:entry.title,level:entry.level,pageIndex}]})
}
export function formattedPageDisplayLabel(page:FormattedBookPage):string{return page.sourceLabel?.trim()??''}
export function isBasmalaLine(value:string):boolean{const text=value.replace(/[ـً-ٰٟ]/g,'').trim();return text==='﷽'||text==='بسم الله الرحمن الرحيم'}
export function isLikelyHeading(value:string):boolean{const line=value.trim().replace(/[.:،؛]$/u,'');return line.length>0&&line.length<=42&&/^(?:الباب|الفصل|المقدمة|الخاتمة|كتاب|باب|فصل|مبحث|تمهيد|الجزء)(?:\s|$)/u.test(line)}

function canvas(){const element=document.createElement('canvas');element.width=CANVAS_WIDTH;element.height=CANVAS_HEIGHT;const context=element.getContext('2d');if(!context)throw new Error('formatted_pdf_canvas_unavailable');context.direction='rtl';context.textAlign='right';context.textBaseline='alphabetic';return{element,context}}
function loadCanvasImage(src:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const image=new Image();image.decoding='async';image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('formatted_pdf_brand_asset_unavailable'));image.src=src})}
function background(context:CanvasRenderingContext2D){context.fillStyle='#fffdf8';context.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);context.strokeStyle='#b59152';context.lineWidth=4;context.strokeRect(54,54,CANVAS_WIDTH-108,CANVAS_HEIGHT-108);context.strokeStyle='#dfcfaa';context.lineWidth=2;context.strokeRect(70,70,CANVAS_WIDTH-140,CANVAS_HEIGHT-140)}
export function wrapPdfParagraphs(measure:(value:string)=>number,value:string,maxWidth:number):FormattedPdfLine[]{const lines:FormattedPdfLine[]=[];const paragraphs=value.replace(/\r/g,'').split('\n');paragraphs.forEach((paragraph,paragraphIndex)=>{const words=paragraph.trim().split(/\s+/u).filter(Boolean),current:string[]=[];let line='';for(const word of words){const candidate=line?`${line} ${word}`:word;if(line&&measure(candidate)>maxWidth){current.push(line);line=word}else line=candidate}if(line)current.push(line);current.forEach((text,index)=>lines.push({text,lastInParagraph:index===current.length-1}));if(paragraphIndex<paragraphs.length-1)lines.push({text:'',lastInParagraph:true})});return lines}
function wrappedLines(context:CanvasRenderingContext2D,value:string,maxWidth:number):string[]{return wrapPdfParagraphs(text=>context.measureText(text).width,value,maxWidth).filter(line=>line.text).map(line=>line.text)}
export function fitPdfTextLayout(measureAtSize:(fontSize:number,value:string)=>number,text:string,maxWidth:number,available:number,measuredLineHeight?:(fontSize:number,text:string)=>number){
  const height=(size:number)=>Math.max(size*1.42,measuredLineHeight?.(size,text)??0)
  for(let fontSize=38;fontSize>=4;fontSize-=2){const lines=wrapPdfParagraphs(value=>measureAtSize(fontSize,value),text,maxWidth),lineHeight=Math.max(fontSize+1,Math.ceil(height(fontSize)));if(lines.length*lineHeight<=available)return{lines,fontSize,lineHeight}}
  // Extremely dense source pages remain one PDF page, but never by reducing
  // the baseline distance below the glyph height (the old overlap bug).
  let fontSize=3,lines=wrapPdfParagraphs(value=>measureAtSize(fontSize,value),text,maxWidth)
  for(let pass=0;pass<8;pass++){const fitted=Math.max(.5,Math.min(fontSize,fontSize*available/(Math.max(1,lines.length)*height(fontSize))));if(Math.abs(fitted-fontSize)<.01)break;fontSize=fitted;lines=wrapPdfParagraphs(value=>measureAtSize(fontSize,value),text,maxWidth)}
  const lineHeight=height(fontSize)
  return{lines,fontSize,lineHeight}
}
function layoutText(context:CanvasRenderingContext2D,text:string){const family='"Khizana PDF Text", serif',layout=fitPdfTextLayout((fontSize,value)=>{context.font=`${fontSize}px ${family}`;return context.measureText(value).width},text,CANVAS_WIDTH-PAGE_MARGIN*2,BODY_BOTTOM-BODY_TOP,(fontSize,value)=>{context.font=`${fontSize}px ${family}`;const metrics=context.measureText(value);return metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent+fontSize*.15});context.font=`${layout.fontSize}px ${family}`;return layout}
export function justifiedWordGap(wordsWidth:number,wordCount:number,naturalSpace:number,maxWidth:number):number|undefined{if(wordCount<2)return undefined;const gap=(maxWidth-wordsWidth)/(wordCount-1);return gap>=naturalSpace&&gap<=naturalSpace*4?gap:undefined}
export function fitPdfCoverTitle(measure:(size:number,text:string)=>number,title:string,maxWidth:number,maxHeight:number){
  for(let fontSize=72;fontSize>=1;fontSize*=.9){
    const lines=wrapPdfParagraphs(text=>measure(fontSize,text),title,maxWidth).filter(line=>line.text).map(line=>line.text),lineHeight=fontSize*1.42
    if(lines.length*lineHeight<=maxHeight&&lines.every(line=>measure(fontSize,line)<=maxWidth))return{lines,fontSize,lineHeight}
  }
  throw new Error('formatted_pdf_title_too_large')
}
function drawJustifiedLine(context:CanvasRenderingContext2D,line:string,y:number,maxWidth:number,justify:boolean){const words=line.split(/\s+/u).filter(Boolean),gap=justify?justifiedWordGap(words.reduce((sum,word)=>sum+context.measureText(word).width,0),words.length,context.measureText(' ').width,maxWidth):undefined;if(gap===undefined){context.textAlign='right';context.fillText(line,CANVAS_WIDTH-PAGE_MARGIN,y);return}let x=CANVAS_WIDTH-PAGE_MARGIN;context.textAlign='right';for(const word of words){context.fillText(word,x,y);x-=context.measureText(word).width+gap}}
function drawFootnoteAwareLine(context:CanvasRenderingContext2D,line:string,y:number,fontSize:number,inFootnoteSection:boolean){
  const runs=formattedPdfTextRuns(line,inFootnoteSection);let x=CANVAS_WIDTH-PAGE_MARGIN;context.textAlign='right'
  for(const run of runs){const baseFont=context.font;if(run.footnoteMarker)context.font=`400 ${Math.max(3,fontSize*.72)}px "Khizana PDF Text", serif`;context.fillText(run.text,x,run.footnoteMarker?y-fontSize*.38:y);x-=context.measureText(run.text).width;context.font=baseFont}
}
async function addCanvasPage(pdf:PDFDocument,element:HTMLCanvasElement):Promise<PDFPage>{const image=await pdf.embedJpg(element.toDataURL('image/jpeg',.92)),page=pdf.addPage([PDF_WIDTH,PDF_HEIGHT]);page.drawImage(image,{x:0,y:0,width:PDF_WIDTH,height:PDF_HEIGHT});return page}
function drawFurniture(context:CanvasRenderingContext2D,book:PdfBook,source:FormattedBookPage){context.fillStyle='#6e532b';context.font='600 25px "Khizana PDF Text", serif';context.textAlign='center';context.fillText(book.title,CANVAS_WIDTH/2,125);context.font='23px "Khizana PDF Text", serif';context.fillText(SITE,CANVAS_WIDTH/2,1602);context.fillText(FOOTER,CANVAS_WIDTH/2,1642);const label=formattedPageDisplayLabel(source);if(label){context.textAlign='left';context.fillText(label,PAGE_MARGIN,1642)}}
async function addCover(pdf:PDFDocument,book:PdfBook){const{element,context}=canvas();background(context);const center=CANVAS_WIDTH/2;context.textAlign='center';context.fillStyle='#153f34';const title=fitPdfCoverTitle((size,text)=>{context.font=`700 ${size}px "Khizana PDF Text", serif`;return context.measureText(text).width},book.title,CANVAS_WIDTH-300,560);context.font=`700 ${title.fontSize}px "Khizana PDF Text", serif`;let y=570-Math.max(0,title.lines.length-1)*title.lineHeight/2;for(const line of title.lines){context.fillText(line,center,y);y+=title.lineHeight}context.strokeStyle='#c5a059';context.lineWidth=5;context.beginPath();context.moveTo(center-170,y+30);context.lineTo(center+170,y+30);context.stroke();context.fillStyle='#563f23';context.font='600 45px "Khizana PDF Text", serif';context.fillText(book.author||'مؤلف غير معروف',center,y+140);context.fillStyle='#153f34';context.font='700 32px "Khizana PDF Text", serif';context.fillText('الخِزانة',center,1330);const logo=await loadCanvasImage(FORMATTED_PDF_BRAND_ASSET),logoSize=170;context.drawImage(logo,center-logoSize/2,1350,logoSize,logoSize);context.font='25px "Khizana PDF Text", serif';context.fillText(SITE,center,1602);context.fillText(FOOTER,center,1642);await addCanvasPage(pdf,element)}
export function installFormattedPdfOutline(pdf:PDFDocument,entries:Array<{title:string;page:PDFPage;level?:number}>){
  if(!entries.length)return
  const root=pdf.context.nextRef()
  type Node={entry:typeof entries[number];ref:PDFRef;level:number;children:Node[];parent:Node|null;index:number}
  const roots:Node[]=[],stack:Node[]=[],nodes:Node[]=[]
  for(const entry of entries){
    const level=Number.isFinite(entry.level)?Math.max(1,Math.trunc(entry.level!)):1
    while(stack.length&&stack.at(-1)!.level>=level)stack.pop()
    const parent=stack.at(-1)??null,node:Node={entry,ref:pdf.context.nextRef(),level,children:[],parent,index:(parent?parent.children:roots).length}
    ;(parent?parent.children:roots).push(node);nodes.push(node);stack.push(node)
  }
  // Process children before parents, avoiding recursive walks for deeply nested TOCs.
  const descendants=new Map<Node,number>()
  for(const node of [...nodes].reverse())descendants.set(node,node.children.reduce((sum,child)=>sum+1+(descendants.get(child)??0),0))
  for(const node of nodes){
    const siblings=node.parent?.children??roots,index=node.index
    pdf.context.assign(node.ref,pdf.context.obj({Title:PDFHexString.fromText(node.entry.title),Parent:node.parent?.ref??root,Dest:[node.entry.page.ref,PDFName.of('Fit')],...(index?{Prev:siblings[index-1]!.ref}:{}),...(index<siblings.length-1?{Next:siblings[index+1]!.ref}:{}),...(node.children.length?{First:node.children[0]!.ref,Last:node.children.at(-1)!.ref,Count:PDFNumber.of(descendants.get(node)!)}:{})}))
  }
  pdf.context.assign(root,pdf.context.obj({Type:'Outlines',First:roots[0]!.ref,Last:roots.at(-1)!.ref,Count:PDFNumber.of(nodes.length)}))
  pdf.catalog.set(PDFName.of('Outlines'),root);pdf.catalog.set(PDFName.of('PageMode'),PDFName.of('UseOutlines'))
}

export async function createFormattedBookPdf(book:PdfBook):Promise<Uint8Array>{const sourcePages=formattedBookSourcePages(book);if(!sourcePages.length)throw new Error('formatted_pdf_text_unavailable');await loadFormattedPdfFont();const pdf=await PDFDocument.create();pdf.setTitle(book.title);pdf.setAuthor(book.author);pdf.setCreator('الخِزانة');pdf.setProducer('الخِزانة');await addCover(pdf,book);const rendered:PDFPage[]=[];for(const source of sourcePages){const{element,context}=canvas();background(context);drawFurniture(context,book,source);const{lines,fontSize,lineHeight}=layoutText(context,source.text);let inFootnoteSection=false;lines.forEach((line,index)=>{if(!line.text)return;if(isFormattedPdfFootnoteDivider(line.text))inFootnoteSection=true;const y=BODY_TOP+index*lineHeight,basmala=isBasmalaLine(line.text),heading=isLikelyHeading(line.text);context.fillStyle=basmala?'#8a642b':heading?'#153f34':'#18211d';context.font=`${(basmala||heading)&&line.text.trim()!=='﷽'?'700':'400'} ${fontSize+(basmala&&line.text.trim()!=='﷽'?4:heading?2:0)}px "Khizana PDF Text", serif`;if(basmala||heading){context.textAlign='center';context.fillText(line.text,CANVAS_WIDTH/2,y)}else if(formattedPdfTextRuns(line.text,inFootnoteSection).some(run=>run.footnoteMarker)||inFootnoteSection)drawFootnoteAwareLine(context,line.text,y,fontSize,inFootnoteSection);else drawJustifiedLine(context,line.text,y,CANVAS_WIDTH-PAGE_MARGIN*2,!line.lastInParagraph)});rendered.push(await addCanvasPage(pdf,element))}installFormattedPdfOutline(pdf,formattedBookOutlineTargets(book,sourcePages).map(entry=>({title:entry.title,level:entry.level,page:rendered[entry.pageIndex]!})));return pdf.save({useObjectStreams:true})}
export function formattedBookNeedsHydration(book:PdfBook):boolean{return !book.bokPages?.length&&!book.extractedText?.trim()&&(Boolean(book.data?.length)||Boolean(book.sourceFormat==='shamela-bok'&&book.id&&(book.sourceKind==='shamela4.1'||book.managedSource==='published')))}
export async function hydrateFormattedBook(book:PdfBook):Promise<PdfBook>{
  if(!formattedBookNeedsHydration(book))return book
  if(book.sourceFormat==='shamela-bok'&&book.id&&(book.sourceKind==='shamela4.1'||book.managedSource==='published')){const {ensureShamelaBookReady}=await import('./shamela_pack_seed');return ensureShamelaBookReady(book.id)}
  if(!book.data?.length)return book
  if(book.sourceFormat==='epub'){const {parseEpub}=await import('./epub_import'),parsed=parseEpub(book.data,book.fileName||'book.epub');return{...book,extractedText:parsed.text,textToc:parsed.toc}}
  if(book.sourceFormat==='shamela-bok'){const {parseBok}=await import('./bok_import'),parsed=parseBok(book.data,book.fileName||'book.bok');return{...book,bokPages:parsed.pages,bokToc:parsed.toc,extractedText:parsed.extractedText}}
  if(book.sourceFormat==='markdown'||book.sourceFormat==='text')return{...book,extractedText:new TextDecoder('utf-8').decode(book.data).replace(/^\uFEFF/u,'').trim()}
  return book
}
export async function openFormattedBookPdf(book:PdfBook):Promise<void>{const hydrated=await hydrateFormattedBook(book),bytes=await createFormattedBookPdf(hydrated),url=URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer],{type:'application/pdf'}));location.assign(url)}

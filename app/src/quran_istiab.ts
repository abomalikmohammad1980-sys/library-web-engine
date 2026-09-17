import {uiTemplateText,uiTemplateAttribute,uiLabelParameter} from './ui_template_binding'
import {h} from './ui'
import {captureRouteResourceScope} from './resource_lifecycle'
import {quranQuotedText} from './quran_quoted_text'
interface Note {id:string;marker:string;text:string}
interface Fragment {sourceRowId:string;sequence:number;part:string;page:number;body:string;footnotes:Note[]}
interface Entry {surah:number;ayah:number;sequence:number;fragments:Fragment[]}
interface Resource {sequence:number;bytes:number}
interface Manifest {schemaVersion:1;bookId:string;verses:Record<string,Resource>;surahs:Record<string,Resource>}
export function validIstiabEntry(value:unknown,surah:number,ayah:number):value is Entry{
 const e=value as Entry|undefined
 return !!e&&e.surah===surah&&e.ayah===ayah&&Number.isInteger(surah)&&surah>=1&&surah<=114&&Number.isInteger(ayah)&&ayah>=0&&ayah<=286&&Number.isInteger(e.sequence)&&e.sequence>=0&&Array.isArray(e.fragments)&&e.fragments.length>0&&e.fragments.length<=64&&e.sequence===e.fragments[0]?.sequence&&e.fragments.every(f=>!!f&&typeof f.sourceRowId==='string'&&/^\d+$/.test(f.sourceRowId)&&Number.isInteger(f.sequence)&&f.sequence>=0&&Number.isInteger(f.page)&&f.page>0&&typeof f.part==='string'&&/^\d+$/.test(f.part)&&typeof f.body==='string'&&Array.isArray(f.footnotes)&&f.footnotes.every(n=>!!n&&typeof n.text==='string'&&typeof n.marker==='string'&&/^[٠-٩0-9]+$/.test(n.marker)&&n.id===`${f.sourceRowId}:${n.marker}`)&&new Set(f.footnotes.map(n=>n.marker)).size===f.footnotes.length)
}
export function istiabFootnoteParts(body:string,notes:Note[]):Array<{text:string;note?:Note}>{
 const result:Array<{text:string;note?:Note}>=[];let offset=0
 for(const match of body.matchAll(/\(¬([٠-٩0-9]+)\)/gu)){result.push({text:body.slice(offset,match.index)});const note=notes.find(n=>n.marker===match[1]);result.push(note?{text:`(${match[1]})`,note}:{text:match[0]});offset=match.index+match[0].length}
 result.push({text:body.slice(offset)});return result
}
async function readResource(path:string,signal:AbortSignal,expectedBytes?:number):Promise<unknown>{
 const response=await fetch(`./quran/resources/${path}`,{signal:AbortSignal.any([signal,AbortSignal.timeout(6000)]),credentials:'same-origin'})
 if(!response.ok||!response.body)throw Error('unavailable')
 const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>131072)throw Error('oversize');parts.push(value)}}catch(error){await reader.cancel();throw error}finally{reader.releaseLock()}
 if(expectedBytes!==undefined&&size!==expectedBytes)throw Error('resource_version_mismatch')
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
 return JSON.parse(new TextDecoder().decode(bytes))
}
export function loadIstiabReading(surah:number,ayah:number,panel:HTMLElement,tools:HTMLElement,isCurrent:()=>boolean=()=>true):()=>void{
 const scope=captureRouteResourceScope(),abort=new AbortController()
 let closeActive=()=>{}
 scope.add(()=>{abort.abort();closeActive()})
 const current=()=>!scope.disposed&&!abort.signal.aborted&&isCurrent()
 const fullBook=()=>h('a',{class:'btn btn--ghost quran-tafsir-open',href:'#/reader/410014582'},'افتحه ككتاب')
 panel.replaceChildren(h('p',{role:'status'},'جارٍ تحميل المقطع…'));tools.replaceChildren(fullBook())
 void readResource('istiab-manifest.json',abort.signal).then(async raw=>{
  const manifest=raw as Manifest
  if(!manifest||manifest.schemaVersion!==1||manifest.bookId!=='410014582'||!manifest.verses||!manifest.surahs)throw Error('invalid_manifest')
  const requested=[{key:`${surah}:${ayah}`,entry:manifest.verses[`${surah}:${ayah}`],path:`istiab-verses/${surah}-${ayah}.json`,ayah},{key:String(surah),entry:manifest.surahs[String(surah)],path:`istiab-surahs/${surah}.json`,ayah:0}].filter(item=>item.entry)
  const entries=await Promise.all(requested.map(async item=>{
   if(!Number.isSafeInteger(item.entry!.bytes)||item.entry!.bytes<=0||item.entry!.bytes>131072||!Number.isSafeInteger(item.entry!.sequence)||item.entry!.sequence<0)throw Error('invalid_manifest_resource')
   const data=await readResource(item.path,abort.signal,item.entry!.bytes) as {schemaVersion:number;bookId:string;entries:Entry[]}
   if(!data||data.schemaVersion!==2||data.bookId!=='410014582'||!Array.isArray(data.entries)||data.entries.length!==1||!validIstiabEntry(data.entries[0],surah,item.ayah)||data.entries[0].sequence!==item.entry!.sequence)throw Error('invalid')
   return data.entries[0]
  }))
  if(!current())return
  const body=h('div',{class:'quran-tafsir-body',style:'white-space:pre-wrap'})
  if(!entries.some(entry=>entry.ayah===ayah))body.append(h('p',null,'لا يوجد مقطع مستقل مرتبط بهذه الآية في فهرس الكتاب.'))
  for(const entry of entries){
  if(entry.ayah===0)body.append(h('h4',null,'مقدمة السورة وما ورد فيها إجمالًا'))
  body.append(...entry.fragments.map(fragment=>h('section',{dataset:{sourceRow:fragment.sourceRowId,noTranslate:''}},h('a',{href:`#/reader/410014582?pageIndex=${fragment.sequence}`},uiTemplateText('3fde208e62ad693f',{p1:fragment.part,p2:fragment.page})),...istiabFootnoteParts(fragment.body,fragment.footnotes).flatMap(part=>{
   if(!part.note)return quranQuotedText(part.text)
   const button=bindQuranUiAttrs(h('button',{type:'button','aria-label': '',dataset:{noteId:part.note.id},style:'vertical-align:super;font-size:.8em'},part.text),[['aria-label','8d9243c4eb0dcf55',{p1:part.text}]])
   let popup:HTMLElement|undefined
   const position=()=>{
    if(!popup)return
    const width=document.documentElement.clientWidth,height=window.innerHeight
    if(width<640){Object.assign(popup.style,{insetInline:'1rem',bottom:'1rem',top:'auto',left:'auto',width:'auto',maxHeight:'45vh'});return}
    const anchor=button.getBoundingClientRect(),below=height-anchor.bottom-16,above=anchor.top-16,down=below>=Math.min(280,above),space=Math.max(60,down?below:above)
    Object.assign(popup.style,{boxSizing:'border-box',insetInline:'auto',bottom:'auto',width:`${Math.min(560,width-32)}px`,maxHeight:`${Math.min(height*.55,space)}px`,left:`${Math.max(16,Math.min(anchor.right-560,width-Math.min(560,width-32)-16))}px`,top:'16px'})
    popup.style.top=`${Math.max(8,Math.min(down?anchor.bottom+8:anchor.top-popup.offsetHeight-8,height-popup.offsetHeight-8))}px`
   }
   const close=()=>{popup?.remove();popup=undefined;button.setAttribute('aria-expanded','false');document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('resize',position);document.removeEventListener('scroll',position,true)}
   const show=()=>{if(popup||!current()||!panel.isConnected)return;closeActive();closeActive=close;const dismiss=h('button',{type:'button'},uiTemplateText('e247c72af5db1232',{p1:uiLabelParameter('إغلاق الحاشية')}));popup=h('aside',{role:'dialog',style:'position:fixed;inset-inline:1rem;bottom:1rem;max-height:45vh;overflow:auto;z-index:10000;padding:1rem;background:var(--surface,#fff);border:1px solid var(--border,#999);white-space:pre-wrap',dataset:{noTranslate:'',noteId:part.note!.id}},dismiss,h('a',{href:`#/reader/410014582?pageIndex=${fragment.sequence}`},uiTemplateText('83428cfd63dd7303',{p1:fragment.part,p2:fragment.page})),h('p',null,...quranQuotedText(part.note!.text)));uiTemplateAttribute(popup,'aria-label','8d9243c4eb0dcf55',{p1:part.text});dismiss.onclick=close;panel.append(popup);button.setAttribute('aria-expanded','true');document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape)}
   const open=()=>{show();if(!popup)return;position();window.addEventListener('resize',position);document.addEventListener('scroll',position,true)}
   button.onmouseenter=open;button.onfocus=open;button.onclick=open;button.setAttribute('aria-expanded','false')
   const outside=(event:Event)=>{if(popup&&!popup.contains(event.target as Node)&&!button.contains(event.target as Node))close()}
   const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')close()}
   return button
  }))))
  }
  let size=1.08;body.style.setProperty('--tafsir-size',`${size}rem`)
  const zoom=(text:string,delta:number)=>{const button=h('button',{type:'button',class:'quran-tafsir-zoom','aria-label':delta<0?'تصغير نص التفسير':'تكبير نص التفسير'},text);button.onclick=()=>{size=Math.max(.85,Math.min(1.8,size+delta));body.style.setProperty('--tafsir-size',`${size.toFixed(2)}rem`)};return button}
  const link=fullBook();if(entries[0])link.href=`#/reader/410014582?pageIndex=${entries[0].sequence}`
  tools.replaceChildren(zoom('−',-.1),zoom('+',.1),link);panel.replaceChildren(body)
 }).catch(()=>{if(current())panel.replaceChildren(h('p',{role:'alert'},'تعذّر تحميل المقطع الموثّق؛ افتح الكتاب للقراءة.'))})
 return()=>{abort.abort();closeActive()}
}

type QuranUiParams = Parameters<typeof uiTemplateText>[1]
function bindQuranUiAttrs<T extends Element>(element:T, bindings:ReadonlyArray<readonly ['aria-label'|'placeholder',string,QuranUiParams]>):T {
 for(const [name,id,parameters] of bindings)uiTemplateAttribute(element,name,id,parameters)
 return element
}

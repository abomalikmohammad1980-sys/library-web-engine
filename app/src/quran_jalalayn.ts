import {h} from './ui'
import {captureRouteResourceScope} from './resource_lifecycle'
import coverage from './quran_jalalayn_coverage.json'
import {loadReadyBokReading} from './quran_ready_bok_reading'
const excluded=new Set(coverage.excluded)
interface Segment {sourceRowId:string;sequence:number;part:string|null;page:number|null;body:string}
interface Verse {schemaVersion:2;bookId:'410012876';surah:number;ayah:number;segments:Segment[]}
export function jalalaynCoverage(surah:number,ayah:number):'confirmed'|'unmapped'|'invalid'{
 if(!Number.isInteger(surah)||!Number.isInteger(ayah)||surah<1||surah>114||ayah<1||ayah>(coverage.counts[surah-1]??0))return 'invalid'
 return excluded.has(surah+':'+ayah)?'unmapped':'confirmed'
}
export function validJalalaynVerse(value:unknown,surah:number,ayah:number):value is Verse{
 const d=value as Partial<Verse>|null
 return !!d&&d.schemaVersion===2&&d.bookId==='410012876'&&d.surah===surah&&d.ayah===ayah&&Array.isArray(d.segments)&&d.segments.length>0&&d.segments.length<=40&&d.segments.every((s,i)=>!!s&&typeof s.sourceRowId==='string'&&/^\d+$/.test(s.sourceRowId)&&Number.isInteger(s.sequence)&&s.sequence>=0&&s.sequence<6934&&(i===0||s.sequence>=d.segments![i-1]!.sequence)&&(s.part===null||typeof s.part==='string')&&(s.page===null||(Number.isInteger(s.page)&&s.page>0))&&typeof s.body==='string'&&!!s.body.trim())
}
export async function loadJalalaynVerse(surah:number,ayah:number,signal:AbortSignal):Promise<Verse>{
 if(jalalaynCoverage(surah,ayah)!=='confirmed')throw Error('unmapped')
 const response=await fetch('./quran/resources/jalalayn-ready/'+surah+'-'+ayah+'.json',{credentials:'same-origin',signal:AbortSignal.any([signal,AbortSignal.timeout(6000)])})
 if(!response.ok||!response.body)throw Error('unavailable')
 const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32768)throw Error('oversize');parts.push(value)}}finally{await reader.cancel();reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
 const data:unknown=JSON.parse(new TextDecoder().decode(bytes));if(!validJalalaynVerse(data,surah,ayah))throw Error('invalid');return data
}
/** Render into the common tafsir card; only verified data may supply a page link. */
export function loadJalalaynReading(surah:number,ayah:number,root:HTMLElement,tools:HTMLElement,isCurrent:()=>boolean=()=>true):()=>void{
 return loadReadyBokReading({readerId:'410012876',confirmed:(s,a)=>jalalaynCoverage(s,a)==='confirmed',load:loadJalalaynVerse},surah,ayah,root,tools,isCurrent)
}
export function jalalaynPanel(surah:number,ayah:number):HTMLElement|undefined{
 const status=jalalaynCoverage(surah,ayah);if(status==='invalid')return undefined
 const title=()=>h('h3',null,'تفسير الجلالين'),book=()=>h('a',{href:'#/reader/410012876'},'فتح تفسير الجلالين ككتاب')
 const panel=h('section',{class:'quran-service quran-jalalayn-panel'},title())
 if(status==='unmapped'){panel.append(h('p',{role:'status'},'لم يكتمل توثيق ربط هذه الآية بصفحات الكتاب بعد.'),book());return panel}
 const scope=captureRouteResourceScope(),abort=new AbortController();scope.add(()=>abort.abort())
 panel.append(h('p',{role:'status'},'جارٍ تحميل تفسير الآية…'))
 void loadJalalaynVerse(surah,ayah,abort.signal).then(data=>{
  if(scope.disposed||abort.signal.aborted)return
  panel.replaceChildren(title(),...data.segments.map(s=>h('div',null,h('p',{class:'quran-tafsir-body',dataset:{noTranslate:''},style:'white-space:pre-wrap'},s.body),h('a',{href:'#/reader/410012876?pageIndex='+s.sequence},'فتح موضع التفسير في الكتاب'+(s.page===null?'':' — الصفحة '+s.page)))))
 }).catch(()=>{if(!scope.disposed&&!abort.signal.aborted)panel.replaceChildren(title(),h('p',{role:'status'},'تعذّر تحميل تفسير الآية؛ يمكنك فتح الكتاب أو إعادة المحاولة.'),book())})
 return panel
}

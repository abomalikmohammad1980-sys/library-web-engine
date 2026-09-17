import type {BodyParagraph} from '@engine/ooxml-model'
export interface FontLineMetrics {unitsPerEm:number;ascent:number;descent:number;lineGap:number;ratio:number;source:'typo'|'matching-hhea-typo'}
/** Fail closed for containers, malformed tables and ambiguous legacy metrics. */
export function readFontLineMetrics(bytes:Uint8Array):FontLineMetrics|null{
 try{
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
  if(bytes.length<12||![0x00010000,0x4f54544f,0x74727565].includes(v.getUint32(0)))return null
  const count=v.getUint16(4);if(!count||count>256||12+count*16>bytes.length)return null
  const tables=new Map<string,{offset:number;length:number}>()
  for(let i=0;i<count;i++){const at=12+i*16,tag=String.fromCharCode(...bytes.subarray(at,at+4)),offset=v.getUint32(at+8),length=v.getUint32(at+12);if(offset>bytes.length||length>bytes.length-offset||tables.has(tag))return null;tables.set(tag,{offset,length})}
  const head=tables.get('head'),hhea=tables.get('hhea'),os2=tables.get('OS/2');if(!head||head.length<20||!hhea||hhea.length<10||!os2||os2.length<78)return null
  const unitsPerEm=v.getUint16(head.offset+18);if(unitsPerEm<16||unitsPerEm>16384)return null
  const h=[v.getInt16(hhea.offset+4),v.getInt16(hhea.offset+6),v.getInt16(hhea.offset+8)]
  const t=[v.getInt16(os2.offset+68),v.getInt16(os2.offset+70),v.getInt16(os2.offset+72)]
  const useTypo=Boolean(v.getUint16(os2.offset+62)&128)
  if(!useTypo&&h.some((value,i)=>value!==t[i]))return null
  const [ascent,descent,gap]=useTypo?t:h
  if(ascent!<=0||descent!>0||gap!<0)return null
  const ratio=(ascent!-descent!+gap!)/unitsPerEm;if(!Number.isFinite(ratio)||ratio<=0||ratio>8)return null
  return {unitsPerEm,ascent:ascent!,descent:descent!,lineGap:gap!,ratio,source:useTypo?'typo':'matching-hhea-typo'}
 }catch{return null}
}
const metrics=new Map<string,FontLineMetrics>()
const key=(family:string,bold:boolean,italic:boolean)=>`${family.trim().toLowerCase()}\0${bold?700:400}\0${italic?'italic':'normal'}`
/** Register only the exact bytes used to construct the corresponding FontFace. */
export function registerFontLineMetrics(family:string,bold:boolean,italic:boolean,bytes:Uint8Array):boolean{
 const id=key(family,bold,italic),value=readFontLineMetrics(bytes);metrics.delete(id)
 if(!family.trim()||!value)return false
 if(metrics.size>=512)metrics.delete(metrics.keys().next().value!)
 metrics.set(id,value);return true
}
export function clearFontLineMetrics():void{metrics.clear()}
export function paragraphNaturalLineTwips(p:BodyParagraph):number|null{
 let largest=0
 for(const run of p.runs){
  if(!run.text||run.hidden)continue
  if(!run.family||!run.emTwips||run.emTwips<=0)return null
  const value=metrics.get(key(run.family,Boolean(run.bold),Boolean(run.italic)));if(!value)return null
  largest=Math.max(largest,run.emTwips*value.ratio)
 }
 if(largest===0&&!p.numbered&&p.paragraphMark?.family&&p.paragraphMark.emTwips){
  const mark=p.paragraphMark,value=metrics.get(key(mark.family!,mark.bold,mark.italic))
  if(value)largest=mark.emTwips!*value.ratio
 }
 return largest>0?largest:null
}

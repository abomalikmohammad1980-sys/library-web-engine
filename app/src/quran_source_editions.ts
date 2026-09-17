import definitions from './quran_source_editions.generated.json'
import packs from './quran_source_packs.generated.json'
import {fetchPackedHeadingPartition} from './heading_dictionary_release'
import {sourceReferenceRange} from './quran_source_reference_range'
import {reviewedTafsirExcerpt} from './quran_reviewed_excerpts'
export interface SourceEditionTafsirDefinition {
 kind:'source-edition-tafsir';slug:string;bookId:number;name:string;author:string;coverage:'complete'|'partial';coveredAyahs:number;sourceUrl:string;sourceVersion:string;manifestPath:string;manifestSha256:string
 files:ReadonlyArray<{surah:number;file:string;byteSize:number;checksumSha256:string;records:number}>
}
export interface SourceEditionSegment {text:string;part?:unknown;page?:unknown;[key:string]:unknown}
export interface SourceEditionReading {title:string;author:string;html:string;hasDirectCommentary:boolean;sourceSegments:SourceEditionSegment[];sourceUrl:string;sourceVersion:string;sharedSourceRange?:{from:number;to:number}}
export const SOURCE_EDITION_TAFSIRS=definitions as readonly SourceEditionTafsirDefinition[]
export function isSourceEditionTafsir(value:unknown):value is SourceEditionTafsirDefinition{return !!value&&typeof value==='object'&&'kind'in value&&value.kind==='source-edition-tafsir'}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const segment=(v:unknown):v is SourceEditionSegment=>object(v)&&typeof v.text==='string'&&!!v.text.trim()
/** Original HTML is returned as data; the caller must use the existing sanitized tafsir renderer. */
export function decodeSourceEditionSurah(value:unknown,definition:SourceEditionTafsirDefinition,surah:number,ayah:number):SourceEditionReading{
 if(!object(value)||![1,2].includes(Number(value.schemaVersion))||value.kind!=='tafsir'||value.slug!==definition.slug||value.bookId!==definition.bookId||value.surah!==surah||!Number.isInteger(value.totalAyahs)||!Number.isInteger(ayah)||ayah<1||ayah>Number(value.totalAyahs)||!Array.isArray(value.records))throw Error('source_edition_identity')
 const seen=new Set<number>();let selected:SourceEditionSegment[]=[];let selectedRange:{from:number;to:number}|undefined
 for(const row of value.records){if(!object(row)||!Number.isInteger(row.ayah)||Number(row.ayah)<1||Number(row.ayah)>Number(value.totalAyahs)||row.from!==row.ayah||row.to!==row.ayah||seen.has(Number(row.ayah)))throw Error('source_edition_verse');seen.add(Number(row.ayah))
  let content:SourceEditionSegment[]
  if(value.schemaVersion===1){if(!Array.isArray(row.sourceSegments)||!row.sourceSegments.every(segment)||typeof row.text!=='string'||row.text!==row.sourceSegments.map(s=>s.text).join('<hr>'))throw Error('source_edition_text');content=row.sourceSegments}
  else{if(!Array.isArray(value.fragments)||!Array.isArray(row.fragmentRefs)||!row.fragmentRefs.length)throw Error('source_edition_fragments');const fragments:unknown[]=value.fragments;content=row.fragmentRefs.map(ref=>{if(!Number.isInteger(ref)||Number(ref)<0||Number(ref)>=fragments.length)throw Error('source_edition_fragment_reference');const s=fragments[Number(ref)];if(!segment(s))throw Error('source_edition_fragment_text');return s})}
  let range:{from:number;to:number}|undefined
  if(row.sourceRange!==undefined){const r=row.sourceRange;if(!object(r)||r.surah!==surah||!Number.isInteger(r.from)||!Number.isInteger(r.to)||Number(r.from)<1||Number(r.from)>Number(row.ayah)||Number(r.to)<Number(row.ayah)||Number(r.to)>Number(value.totalAyahs))throw Error('source_edition_section_range');range={from:Number(r.from),to:Number(r.to)}}
  if(row.ayah===ayah){selected=content;selectedRange=range}
 }
 // Quarantine a verified upstream verse-identity error in this exact asset revision.
 // Keep the original asset intact; a corrected asset has a different checksum.
 if(definition.slug==='manar'&&surah===114&&ayah===1&&definition.files.find(f=>f.surah===114)?.checksumSha256==='f24247fe72cf153adac65325a799d907acb8fa1675bcd7f04dcd519a934d95d7')selected=[]
 const sharedSourceRange=selected.length?(selectedRange??sourceReferenceRange(value,surah,ayah)):undefined
 const originalHtml=selected.map(s=>s.text).join('<hr>'),excerpt=reviewedTafsirExcerpt(definition,surah,ayah,originalHtml)
 return {title:definition.name,author:definition.author,html:excerpt??originalHtml,hasDirectCommentary:selected.length>0,sourceSegments:selected,sourceUrl:definition.sourceUrl,sourceVersion:definition.sourceVersion,...(excerpt===undefined&&sharedSourceRange?{sharedSourceRange}:{})}
}
export async function loadSourceEditionTafsir(definition:SourceEditionTafsirDefinition,surah:number,ayah:number,options:{signal?:AbortSignal;retry?:boolean}={}):Promise<SourceEditionReading>{
 const canonical=SOURCE_EDITION_TAFSIRS.find(d=>d.slug===definition.slug&&d.bookId===definition.bookId);if(!canonical)throw Error('source_edition_unknown')
 const file=canonical.files.find(f=>f.surah===surah);if(!file||file.file!==surah+'.json'||file.byteSize>64000000)throw Error('source_edition_file')
 const init:RequestInit={credentials:'same-origin',cache:options.retry?'reload':'force-cache',signal:options.signal??null}
 const location=(packs as Record<string,Record<string,{path:string;offset:number;bytes:number;packBytes:number}>>)[canonical.slug]?.[file.file]
 const base='./quran/resources/source-editions/'+canonical.slug+'/'
 const response=location?await fetchPackedHeadingPartition(new URL(base+location.path,document.baseURI),location,init):await fetch(base+file.file,init);if(!response.ok||!response.body)throw Error('source_edition_unavailable')
 const chunks:Uint8Array[]=[];let size=0;const reader=response.body.getReader();try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>file.byteSize)throw Error('source_edition_size');chunks.push(next.value)}}finally{await reader.cancel();reader.releaseLock()}
 if(size!==file.byteSize)throw Error('source_edition_size');const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(digest!==file.checksumSha256)throw Error('source_edition_checksum')
 return decodeSourceEditionSurah(JSON.parse(new TextDecoder().decode(bytes)),canonical,surah,ayah)
}

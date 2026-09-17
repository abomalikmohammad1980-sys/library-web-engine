import type {LiteEntry} from './packed_term_directory_lite'
const SHA=/^[a-f0-9]{64}$/
const integer=(value:unknown,min:number)=>Number.isSafeInteger(value)&&Number(value)>=min
/** Descriptor must come from a trusted release manifest, never the response being checked. */
export async function decodeSnippetRowDirectory(bytes:Uint8Array,expected:{sha256:string;byteLength:number;releaseId:string;path:string},sha:(bytes:Uint8Array)=>Promise<string>):Promise<Map<string,LiteEntry>>{
 if(!SHA.test(expected.sha256)||!integer(expected.byteLength,1)||expected.byteLength>2*1024*1024||bytes.length!==expected.byteLength||await sha(bytes)!==expected.sha256)throw Error('snippet_directory_integrity')
 const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
 if(value.contract!=='snippet-row-directory/1'||value.releaseId!==expected.releaseId||value.path!==expected.path||!Array.isArray(value.entries)||value.entries.length>10000)throw Error('snippet_directory_identity')
 const out=new Map<string,LiteEntry>()
 for(const row of value.entries){
  if(!Array.isArray(row)||row.length!==2||typeof row[0]!=='string'||!/^\d+:\d+$/.test(row[0])||out.has(row[0]))throw Error('snippet_directory_row')
  const entry=row[1]
  if(!entry||!integer(entry.byteLength,1)||!SHA.test(entry.sha256)||!Array.isArray(entry.parts)||!entry.parts.length||entry.parts.length>64)throw Error('snippet_directory_pointer')
  let size=0
  for(const part of entry.parts){if(!part||!integer(part.project,0)||typeof part.archive!=='string'||!/^\d{6}$/.test(part.archive)||!integer(part.offset,0)||!integer(part.length,1)||!Number.isSafeInteger(part.offset+part.length)||!SHA.test(part.sha256))throw Error('snippet_directory_part');size+=part.length}
  if(size!==entry.byteLength)throw Error('snippet_directory_length')
  out.set(row[0],entry)
 }
 return out
}

// Structural rejection gate, NOT antivirus/CDR or a certificate of file safety.
// No Office execution, remote resource loading, filesystem extraction or shell calls.
const MAX_XML=16*1024*1024,MAX_TOTAL=256*1024*1024
const decoder=new TextDecoder('utf-8',{fatal:true})
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength)
function onlyNavigationRelationships(text){
 // Exempt only a fully parsed self-closing hyperlink record. Anything else
 // marked External remains rejected; do not fetch or resolve its target.
 const remaining=text.replace(/<Relationship\s+((?:"[^"<>]*"|'[^'<>]*'|[^'"<>])*)\/>/g,(whole,body)=>{
  const attrs=new Map();let end=0
  for(const match of body.matchAll(/([A-Za-z_][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g)){
   if(body.slice(end,match.index).trim()||attrs.has(match[1]))return whole
   attrs.set(match[1],match[2].slice(1,-1));end=match.index+match[0].length
  }
  if(body.slice(end).trim()||attrs.get('TargetMode')!=='External')return whole
  if(!['http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink','http://purl.oclc.org/ooxml/officeDocument/relationships/hyperlink'].includes(attrs.get('Type')))return whole
  const target=attrs.get('Target')??''
  if(!/^https?:\/\//i.test(target)||/[\x00-\x20\\]/.test(target))return whole
  try{const url=new URL(target);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return whole}catch{return whole}
  return ''
 })
 return !/TargetMode\s*=\s*["']External["']/i.test(remaining)
}
async function bytes(file,start,end){return new Uint8Array(await file.slice(start,end).arrayBuffer())}
async function xmlText(file,entry){
 if(entry.size>MAX_XML)throw Error('xml_limit')
 let stream=file.slice(entry.start,entry.end).stream()
 if(entry.method===8)stream=stream.pipeThrough(new DecompressionStream('deflate-raw'))
 const reader=stream.getReader(),chunks=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>entry.size||size>MAX_XML)throw Error('inflate_limit');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
 if(size!==entry.size)throw Error('size_mismatch')
 const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length}
 // Reject non-UTF8 XML rather than scanning an alternate encoding incorrectly.
 const text=decoder.decode(all);if(text.includes('\0')||/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('xml_entities')
 return text.replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n)))
}
export async function safeWordUpload(file){
 const ext=/\.[^.]+$/.exec(file.name.toLowerCase())?.[0]
 if(ext==='.doc'||ext==='.rtf')return false // Requires a separately isolated scanning/conversion service.
 if(ext!=='.docx')return true
 try{
  const tail=await bytes(file,Math.max(0,file.size-65557),file.size),tv=view(tail);let e=-1
  for(let i=tail.length-22;i>=0;i--)if(tv.getUint32(i,true)===0x06054b50&&i+22+tv.getUint16(i+20,true)===tail.length){e=i;break}
  if(e<0||tv.getUint16(e+4,true)||tv.getUint16(e+6,true))return false
  const count=tv.getUint16(e+10,true),length=tv.getUint32(e+12,true),start=tv.getUint32(e+16,true)
  if(!count||count>4096||count!==tv.getUint16(e+8,true)||length>2*1024*1024||start+length!==file.size-tail.length+e)return false
  const central=await bytes(file,start,start+length),cv=view(central),names=new Set(),entries=[];let p=0,total=0,xmlTotal=0
  for(let i=0;i<count;i++){
   if(p+46>central.length||cv.getUint32(p,true)!==0x02014b50)return false
   const flags=cv.getUint16(p+8,true),method=cv.getUint16(p+10,true),packed=cv.getUint32(p+20,true),size=cv.getUint32(p+24,true),n=cv.getUint16(p+28,true),extra=cv.getUint16(p+30,true),comment=cv.getUint16(p+32,true),local=cv.getUint32(p+42,true)
   if(p+46+n+extra+comment>central.length||flags&~0x80e||![0,8].includes(method)||cv.getUint16(p+34,true))return false
   const name=decoder.decode(central.slice(p+46,p+46+n)),lower=name.toLowerCase()
   if(!name||names.has(lower)||/[\\\x00-\x1f%:]/.test(name)||name.startsWith('/')||name.split('/').some(x=>x==='..'||x==='.'))return false
   names.add(lower);total+=size;if(total>MAX_TOTAL||size>Math.max(1024*1024,packed*200))return false
   if(/vba|activex|embeddings|customui/i.test(name)||/\.(?:bin|exe|dll|com|js|vbs|hta|html?)$/i.test(name))return false
   const header=await bytes(file,local,local+30),hv=view(header)
   if(header.length!==30||hv.getUint32(0,true)!==0x04034b50||hv.getUint16(6,true)!==flags||hv.getUint16(8,true)!==method)return false
   const ln=hv.getUint16(26,true),le=hv.getUint16(28,true),body=local+30+ln+le
   if(body+packed>start||decoder.decode(await bytes(file,local+30,local+30+ln))!==name)return false
   if(!(flags&8)&&(hv.getUint32(18,true)!==packed||hv.getUint32(22,true)!==size))return false
   const entry={name,local,start:body,end:body+packed,method,size,flags};entries.push(entry)
   if(/\.(?:xml|rels)$/i.test(name)){
    xmlTotal+=size;if(xmlTotal>64*1024*1024)return false
    const text=await xmlText(file,entry)
    if(/macroEnabled|vbaProject|activeX|oleObject|attachedTemplate|altChunk|DDEAUTO|\bDDE\b/i.test(text))return false
    if(/\.rels$/i.test(name)&&!onlyNavigationRelationships(text))return false
   }
   p+=46+n+extra+comment
  }
  if(p!==central.length||!names.has('[content_types].xml')||!names.has('word/document.xml'))return false
  entries.sort((a,b)=>a.local-b.local)
  if(entries[0].local!==0)return false
  for(let i=0;i<entries.length;i++){const a=entries[i],next=entries[i+1]?.local??start,gap=next-a.end;if(gap!==0&&(!(a.flags&8)||![12,16].includes(gap)))return false}
  return true
 }catch{return false}
}

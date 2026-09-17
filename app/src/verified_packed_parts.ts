/** Inputs must already have passed each part's SHA check. */
export async function assembleVerifiedPackedParts(chunks:Uint8Array[],entry:{byteLength:number;sha256:string;parts:Array<{sha256:string}>},sha256:(bytes:Uint8Array)=>Promise<string>):Promise<Uint8Array>{
  if(chunks.length!==entry.parts.length||!chunks.length||chunks.reduce((n,bytes)=>n+bytes.byteLength,0)!==entry.byteLength)throw Error('shamela_search_v2_packed_key_corrupt')
  if(chunks.length===1){
    if(entry.parts[0]!.sha256!==entry.sha256)throw Error('shamela_search_v2_packed_key_corrupt')
    return chunks[0]!
  }
  const out=new Uint8Array(entry.byteLength);let offset=0
  for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length}
  if(await sha256(out)!==entry.sha256)throw Error('shamela_search_v2_packed_key_corrupt')
  return out
}

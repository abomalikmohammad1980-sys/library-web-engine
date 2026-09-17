import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'

export const MAX_SOURCE_PACK_BYTES=25*1024*1024-1
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
export function buildSourceEditionPacks(files,limit=MAX_SOURCE_PACK_BYTES){
 if(!Number.isSafeInteger(limit)||limit<1||limit>MAX_SOURCE_PACK_BYTES)throw Error('invalid_pack_limit')
 const bundles=[],locations={},seen=new Set();let chunks=[],entries=[],size=0
 const flush=()=>{if(!entries.length)return;const bytes=Buffer.concat(chunks),path='packed-v1/'+sha(bytes)+'.bin';bundles.push({path,bytes});for(const entry of entries)locations[entry.file]={offset:entry.offset,bytes:entry.bytes,path,packBytes:bytes.length};chunks=[];entries=[];size=0}
 for(const file of files){
  if(!/^\d+\.json$/.test(file.file)||seen.has(file.file))throw Error('pack_file_identity')
  seen.add(file.file)
  if(file.bytes.length!==file.byteSize||sha(file.bytes)!==file.checksumSha256)throw Error('edition_integrity')
  if(!file.bytes.length||file.bytes.length>limit)throw Error('pack_file_too_large')
  if(size+file.bytes.length>limit)flush()
  entries.push({file:file.file,offset:size,bytes:file.bytes.length});chunks.push(file.bytes);size+=file.bytes.length
 }
 flush();return {bundles,locations}
}
export function copySourceEditionAsset(path,packs){
 const match=path.match(/[\\/]source-editions[\\/]([^\\/]+)[\\/](\d+\.json)$/)
 return !match||!Object.hasOwn(packs,match[1])||!Object.hasOwn(packs[match[1]],match[2])
}
export async function readVerifiedSourceFile(base,file,location,cache=new Map()){
 let bytes
 if(location){
  if(!/^packed-v1\/[a-f0-9]{64}\.bin$/.test(location.path)||!Number.isSafeInteger(location.offset)||location.offset<0||!Number.isSafeInteger(location.bytes)||location.bytes<1||!Number.isSafeInteger(location.packBytes)||location.packBytes>MAX_SOURCE_PACK_BYTES||location.offset+location.bytes>location.packBytes)throw Error('pack_location_invalid')
  const path=resolve(base,location.path)
  if(!cache.has(path)){const packed=await readFile(path);if(packed.length!==location.packBytes||sha(packed)!==location.path.slice(10,-4))throw Error('pack_integrity');cache.set(path,packed)}
  const packed=cache.get(path)
  if(packed.length!==location.packBytes)throw Error('pack_size_mismatch')
  bytes=packed.subarray(location.offset,location.offset+location.bytes)
 }else bytes=await readFile(resolve(base,file.file))
 if((file.byteSize!==undefined&&bytes.length!==file.byteSize)||sha(bytes)!==file.checksumSha256)throw Error('source_file_integrity:'+file.file)
 return bytes
}

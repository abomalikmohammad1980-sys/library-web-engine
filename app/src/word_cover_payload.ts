import {unzipSync} from 'fflate'
import {rasterPayload} from '@engine/ooxml-dom'
import {discoverWordCover} from '@library/word-cover'
/** Word parsing is loaded only for a visible cover backed by actual bytes. */
export function wordCoverPayload(data:Uint8Array,path?:string):{bytes:Uint8Array;mimeType:string}|undefined{
 if(!data?.length)return undefined
 if(!path)return discoverWordCover(data)
 try{const bytes=unzipSync(data)[`word/${path}`];const payload=bytes&&rasterPayload(bytes);return payload?{bytes:payload.bytes,mimeType:payload.mime}:undefined}catch{return undefined}
}

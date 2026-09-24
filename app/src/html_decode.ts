import {MAX_HTML_BYTES} from './html_source_limits'

/** Decode an HTML original without asking the browser to load or execute it. */
export function decodeHtmlOriginal(data:Uint8Array):string{
 if(!data.length)throw Error('ملف HTML فارغ')
 if(data.length>MAX_HTML_BYTES)throw Error('حجم ملف HTML يتجاوز 20 ميجابايت')
 const prefix=new TextDecoder('latin1').decode(data.subarray(0,Math.min(data.length,4096)))
 const declared=prefix.match(/<meta\b[^>]*\bcharset\s*=\s*["']?\s*([a-z0-9._-]+)/i)?.[1]
 const bom=data.length>=3&&data[0]===0xef&&data[1]===0xbb&&data[2]===0xbf?'utf-8':data.length>=2&&data[0]===0xff&&data[1]===0xfe?'utf-16le':data.length>=2&&data[0]===0xfe&&data[1]===0xff?'utf-16be':''
 const encoding=bom||declared||'utf-8'
 let decoded:string
 try{decoded=new TextDecoder(encoding,{fatal:true}).decode(data)}
 catch{throw Error(declared?`ترميز HTML المعلن غير مدعوم أو الملف تالف: ${declared}`:'ملف HTML ليس نص UTF-8 صالحًا؛ أضف تصريح الترميز الأصلي')}
 decoded=decoded.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n')
 if(!decoded.trim())throw Error('ملف HTML لا يحتوي نصًا مقروءًا')
 return decoded
}

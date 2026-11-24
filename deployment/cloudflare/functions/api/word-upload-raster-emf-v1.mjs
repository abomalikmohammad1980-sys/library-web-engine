const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength)

// Keep the ordinary per-part ZIP ratio. The only exception is a bitmap-only EMF
// with one uncompressed 32-bit DIB, within 32 MiB per bitmap and 64 MiB expanded total per DOCX.
// MS-EMF 2.3.1.7, 2.3.4.1, 2.3.4.2. No graphics decoder is invoked here.
const MAX_HIGH_RATIO_EMF=32*1024*1024
const MAX_HIGH_RATIO_EMF_TOTAL=64*1024*1024
const emfCrcTable=Uint32Array.from({length:256},(_,index)=>{
 let value=index
 for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0)
 return value>>>0
})
function rasterEmfStructure(prefix,eof,expanded){
 const h=view(prefix),last=view(eof),header=108,bitmap=188,record=108
 const u=at=>h.getUint32(at,true),i=at=>h.getInt32(at,true)
 if(u(0)!==1||u(4)!==header||u(40)!==0x464d4520||u(44)!==0x00010000||
    u(48)!==expanded||u(52)!==3||u(56)!==1||[60,64,68,88,92,96].some(at=>u(at)!==0))return false
 const recordSize=u(record+4),pixels=u(record+60)
 if(u(record)!==81||recordSize!==expanded-header-20||recordSize!==120+pixels||
    i(record+32)!==0||i(record+36)!==0||u(record+48)!==80||u(record+52)!==40||
    u(record+56)!==120||u(record+64)!==0||u(record+68)!==0x00cc0020)return false
 const width=i(bitmap+4),height=i(bitmap+8),srcWidth=i(record+40),destWidth=i(record+72),destHeight=i(record+76)
 if(u(bitmap)!==40||width<1||width>4096||height<1||height>4096||u(bitmap+12)!==0x00200001||
    u(bitmap+16)!==0||u(bitmap+20)!==pixels||u(bitmap+32)!==0||u(bitmap+36)!==0||
    pixels!==width*height*4||srcWidth<width||(srcWidth>width+1&&!(srcWidth===Math.ceil(width/4)*4&&destWidth===srcWidth))||i(record+44)!==height||
    destWidth<1||destWidth>4096||destHeight<1||destHeight>4096)return false
 return last.getUint32(0,true)===14&&last.getUint32(4,true)===20&&last.getUint32(8,true)===0&&
  last.getUint32(12,true)===16&&last.getUint32(16,true)===20
}
async function safeHighRatioRasterEmf(file,entry,expectedCrc){
 // Only the small fixed headers are retained. Actual output, aggregate
 // declaration and CRC are checked without buffering or rendering pixels.
 if(entry.size<248||entry.size>MAX_HIGH_RATIO_EMF||entry.method!==8||(entry.flags&8))return false
 const prefix=new Uint8Array(228),eof=new Uint8Array(20),tail=entry.size-eof.length
 const reader=file.slice(entry.start,entry.end).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader()
 let size=0,crc=0xffffffff
 try{
  for(;;){
   const {done,value}=await reader.read()
   if(done)break
   const end=size+value.length
   if(end>entry.size||end>MAX_HIGH_RATIO_EMF)return false
   if(size<prefix.length)prefix.set(value.subarray(0,prefix.length-size),size)
   if(end>tail){
    const from=Math.max(size,tail)
    eof.set(value.subarray(from-size),from-tail)
   }
   for(let j=0;j<value.length;j++)crc=emfCrcTable[(crc^value[j])&0xff]^(crc>>>8)
   size=end
  }
 }finally{await reader.cancel().catch(()=>{})}
 return size===entry.size&&((crc^0xffffffff)>>>0)===expectedCrc&&rasterEmfStructure(prefix,eof,size)
}

export {MAX_HIGH_RATIO_EMF,MAX_HIGH_RATIO_EMF_TOTAL,safeHighRatioRasterEmf}

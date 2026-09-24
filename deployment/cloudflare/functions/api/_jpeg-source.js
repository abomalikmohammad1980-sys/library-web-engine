/** Bounded header inspection; original content is always delivered as an attachment. */
export async function validJpegSource(file){
 if(file.size<4||file.size>32*1024*1024)return false
 const start=new Uint8Array(await file.slice(0,2).arrayBuffer())
 if(start[0]!==255||start[1]!==216)return false
 let offset=2
 for(let count=0;count<512&&offset<file.size;count++){
  const head=new Uint8Array(await file.slice(offset,offset+12).arrayBuffer())
  if(head[0]!==255)return false
  if(head[1]===255){offset++;continue}
  const marker=head[1]
  if(marker===217||marker===218)return false
  if(marker===1||marker>=208&&marker<=215){offset+=2;continue}
  const length=(head[2]<<8)|head[3]
  if(length<2||offset+2+length>file.size)return false
  if(marker===192||marker===193||marker===194){
   const height=(head[5]<<8)|head[6],width=(head[7]<<8)|head[8]
   return length>=8&&width>0&&height>0&&width*height<=40_000_000
  }
  offset+=2+length
 }
 return false
}

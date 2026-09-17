export interface GroupPart {project:number;archive:string;offset:number;length:number;sha256:string}
export interface RangeGroup {project:number;archive:string;offset:number;length:number;members:Array<{index:number;part:GroupPart}>}
/** Bounded overfetch: same archive only, <=4KiB gaps, <=256KiB merged range. */
export function groupPackedRanges(parts:readonly GroupPart[]):RangeGroup[]{
 const ordered=parts.map((part,index)=>({part,index})).sort((a,b)=>a.part.project-b.part.project||a.part.archive.localeCompare(b.part.archive)||a.part.offset-b.part.offset),groups:RangeGroup[]=[]
 for(const item of ordered){
  const {part}=item
  if(!Number.isSafeInteger(part.project)||part.project<0||!/^\d{6}$/.test(part.archive)||!Number.isSafeInteger(part.offset)||part.offset<0||!Number.isSafeInteger(part.length)||part.length<1||!Number.isSafeInteger(part.offset+part.length)||!/^[a-f0-9]{64}$/.test(part.sha256))throw Error('packed_group_invalid_part')
  const prior=groups.at(-1),end=part.offset+part.length
  if(prior&&prior.project===part.project&&prior.archive===part.archive&&part.offset<=prior.offset+prior.length+4096&&Math.max(prior.offset+prior.length,end)-prior.offset<=256*1024){prior.length=Math.max(prior.offset+prior.length,end)-prior.offset;prior.members.push(item)}
  else groups.push({project:part.project,archive:part.archive,offset:part.offset,length:part.length,members:[item]})
 }
 return groups
}
/** Whole response need not have a precomputed hash: every requested slice does. */
export async function readGroupedPackedRanges(parts:readonly GroupPart[],read:(group:RangeGroup)=>Promise<Uint8Array>,sha:(bytes:Uint8Array)=>Promise<string>):Promise<Uint8Array[]>{
 const groups=groupPackedRanges(parts),result:Uint8Array[]=new Array(parts.length)
 for(let start=0;start<groups.length;start+=8)await Promise.all(groups.slice(start,start+8).map(async group=>{
  const bytes=await read(group);if(bytes.length!==group.length)throw Error('packed_group_length')
  for(const {part,index} of group.members){const slice=bytes.slice(part.offset-group.offset,part.offset-group.offset+part.length);if(await sha(slice)!==part.sha256)throw Error('packed_group_corrupt');result[index]=slice}
 }))
 return result
}

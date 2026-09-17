export interface HeadingBookRanges {manifestSha256:string;rowCount:number;ranges:readonly (readonly [string,number,number])[]}
export async function loadHeadingBookRanges(kind:'primary'|'supplement'):Promise<HeadingBookRanges>{
 const {default:data}=await import('./heading_book_ranges.generated.json')
 const value=data[kind] as unknown as HeadingBookRanges
 validateHeadingBookRanges(value,value.rowCount)
 return value
}
export function validateHeadingBookRanges(value:HeadingBookRanges,rowCount:number):void{
 if(!/^[a-f0-9]{64}$/.test(value.manifestSha256)||value.rowCount!==rowCount)throw Error('heading_book_ranges_integrity')
 let next=0
 for(const [book,start,count] of value.ranges){
  if(!/^[1-9]\d*$/.test(book)||start!==next||!Number.isSafeInteger(count)||count<1)throw Error('heading_book_ranges_integrity')
  next+=count
 }
 if(next!==rowCount)throw Error('heading_book_ranges_integrity')
}
/** Filter ordered posting IDs before row fetching; gaps remain excluded. */
export function filterHeadingBookRows(ids:readonly number[],bookIds:readonly string[],ranges:HeadingBookRanges):number[]{
 const allowed=new Set(bookIds),selected:number[]=[];let at=0
 for(const id of ids){
  while(at<ranges.ranges.length&&id>=ranges.ranges[at]![1]+ranges.ranges[at]![2])at++
  const range=ranges.ranges[at]
  if(range&&id>=range[1]&&allowed.has(range[0]))selected.push(id)
 }
 return selected
}

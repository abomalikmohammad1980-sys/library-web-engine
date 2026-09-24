/** Measured page heights without keeping thousands of page slots in the DOM. */
export class ReaderVirtualHeights {
 private readonly deltas:Float64Array
 private readonly measured=new Map<number,number>()
 constructor(readonly count:number,public estimate:number){
  if(!Number.isSafeInteger(count)||count<1||!Number.isFinite(estimate)||estimate<1)throw Error('reader_virtual_heights_invalid')
  this.deltas=new Float64Array(count+1)
 }
 height(index:number):number{return this.measured.get(index)??this.estimate}
 /** A reading-mode switch changes the same outer margin on every slot. */
 shiftAll(delta:number):void{
  if(!Number.isFinite(delta)||this.estimate+delta<1)throw Error('reader_virtual_shift_invalid')
  for(const height of this.measured.values())if(height+delta<1)throw Error('reader_virtual_shift_invalid')
  this.estimate+=delta
  for(const [index,height] of this.measured)this.measured.set(index,height+delta)
 }
 set(index:number,height:number):void{
  if(!Number.isSafeInteger(index)||index<0||index>=this.count||!Number.isFinite(height)||height<1)throw Error('reader_virtual_height_invalid')
  const delta=height-this.height(index)
  if(!delta)return
  this.measured.set(index,height)
  for(let i=index+1;i<=this.count;i+=i&-i)this.deltas[i]!+=delta
 }
 /** Sum of pages before index; index=count gives the total stream height. */
 prefix(index:number):number{
  if(!Number.isSafeInteger(index)||index<0||index>this.count)throw Error('reader_virtual_prefix_invalid')
  let extra=0
  for(let i=index;i>0;i-=i&-i)extra+=this.deltas[i]!
  return index*this.estimate+extra
 }
 atOffset(offset:number):number{
  if(!Number.isFinite(offset)||offset<=0)return 0
  if(offset>=this.prefix(this.count))return this.count-1
  let low=0,high=this.count-1
  while(low<high){const middle=low+Math.floor((high-low)/2);if(this.prefix(middle+1)<=offset)low=middle+1;else high=middle}
  return low
 }
 window(center:number,radius=12):{start:number;end:number;before:number;after:number}{
  const safe=Math.max(0,Math.min(this.count-1,Math.trunc(Number.isFinite(center)?center:0)))
  const start=Math.max(0,safe-radius),end=Math.min(this.count-1,safe+radius)
  return{start,end,before:this.prefix(start),after:this.prefix(this.count)-this.prefix(end+1)}
 }
}

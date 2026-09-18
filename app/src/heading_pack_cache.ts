/** Public content-addressed packs only; complete verified bytes, bounded per client. */
export class HeadingPackCache {
 private entries=new Map<string,Uint8Array>()
 private bytes=0
 constructor(private readonly budget=32*1024*1024){}
 get(url:URL,size:number):Uint8Array|undefined{
  const value=this.entries.get(url.href)
  if(!value||value.length!==size)return undefined
  this.entries.delete(url.href);this.entries.set(url.href,value)
  return value
 }
 async remember(url:URL,value:Uint8Array):Promise<void>{
  const expected=/\/([a-f0-9]{64})\.bin$/.exec(url.pathname)?.[1]
  if(!expected||url.search||value.length>this.budget)return
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',value.slice().buffer))].map(n=>n.toString(16).padStart(2,'0')).join('')
  if(hash!==expected)throw Error('heading_partition_pack_integrity')
  const old=this.entries.get(url.href)
  if(old){this.bytes-=old.length;this.entries.delete(url.href)}
  while(this.entries.size&&this.bytes+value.length>this.budget){const key=this.entries.keys().next().value!;this.bytes-=this.entries.get(key)!.length;this.entries.delete(key)}
  this.entries.set(url.href,value);this.bytes+=value.length
 }
}

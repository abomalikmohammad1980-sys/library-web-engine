/** Bounded reuse of decoded term postings. Weight is the packed entry byteLength,
 * not a claim about the JavaScript heap size of the decoded value. */
export class PackedTermCache<T> {
  private readonly values=new Map<string,{value:T;bytes:number}>()
  private readonly pending=new Map<string,Promise<T>>()
  private bytes=0
  private readonly maxEntries:number
  private readonly maxBytes:number
  constructor(options:{maxEntries?:number;maxBytes?:number}={}){
    this.maxEntries=Math.max(0,Math.floor(options.maxEntries??64))
    this.maxBytes=Math.max(0,Math.floor(options.maxBytes??16*1024*1024))
    if(!Number.isFinite(this.maxEntries)||!Number.isFinite(this.maxBytes))throw new RangeError('invalid_cache_budget')
  }
  get size():number{return this.values.size}
  get byteSize():number{return this.bytes}
  get(releaseId:string,word:string,byteLength:number,load:()=>Promise<T>):Promise<T>{
    const key=JSON.stringify([releaseId,word]),cached=this.values.get(key)
    if(cached){this.values.delete(key);this.values.set(key,cached);return Promise.resolve(cached.value)}
    const existing=this.pending.get(key);if(existing)return existing
    const request=Promise.resolve().then(load).then(value=>{
      if(this.maxEntries>0&&Number.isSafeInteger(byteLength)&&byteLength>=0&&byteLength<=this.maxBytes){
        while(this.values.size>=this.maxEntries||this.bytes+byteLength>this.maxBytes){
          const oldest=this.values.keys().next().value as string|undefined
          if(oldest===undefined)break
          this.bytes-=this.values.get(oldest)!.bytes;this.values.delete(oldest)
        }
        this.values.set(key,{value,bytes:byteLength});this.bytes+=byteLength
      }
      return value
    }).finally(()=>{this.pending.delete(key)})
    this.pending.set(key,request);return request
  }
}

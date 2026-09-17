type Part={project:number;archive:string;offset:number;length:number;sha256:string}
/** Both transports deliver the identical original bytes to the same SHA check. */
export class PackedPartTransport {
  private unsupported=false
  constructor(private readonly fetcher:typeof fetch){}
  async read(base:string,part:Part,releaseId:string,sha256:(bytes:Uint8Array)=>Promise<string>,origin=globalThis.location?.origin,enabled=false):Promise<Uint8Array>{
    let response:Response|undefined,compressed=false
    const parsed=new URL(base),local=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(parsed.hostname)
    if(enabled&&!this.unsupported&&!local&&origin===parsed.origin&&parsed.pathname===`/r2/khezana-search-v2-${String(part.project).padStart(2,'0')}`&&part.length<=8*1024*1024){
      const url=new URL('/api/search/packed-part',origin)
      url.search=new URLSearchParams({project:String(part.project),archive:part.archive,offset:String(part.offset),length:String(part.length),v:`${releaseId}:${part.sha256}`}).toString()
      try {response=await this.fetcher(url.href)} catch {response=undefined}
      if(response?.status===200){
        if(response.headers.get('x-packed-offset')!==String(part.offset)||response.headers.get('x-packed-length')!==String(part.length)){await response.body?.cancel();throw Error('shamela_search_v2_packed_compressed_metadata_invalid')}
        compressed=true
      } else if(response){
        if([404,405,501].includes(response.status))this.unsupported=true
        await response.body?.cancel();response=undefined
      }
    }
    const end=part.offset+part.length-1
    if(!response){
      response=await this.fetcher(`${base.replace(/\/$/u,'')}/archives/${part.archive}.bin?v=${encodeURIComponent(`${releaseId}:${part.sha256}:verified-2`)}`,{headers:{Range:`bytes=${part.offset}-${end}`}})
      if(response.status===404)throw Error('shamela_search_v2_packed_archive_missing')
      if(!response.ok)throw Error('shamela_search_v2_packed_range_unavailable')
    }
    if(!compressed&&(response.status!==206||!new RegExp(`^bytes\\s+${part.offset}-${end}/\\d+$`,'iu').test(response.headers.get('content-range')??'')||Number(response.headers.get('content-length'))!==part.length)){await response.body?.cancel();throw Error('shamela_search_v2_packed_range_ignored')}
    const bytes=new Uint8Array(await response.arrayBuffer()),actualSha=await sha256(bytes)
    if(bytes.byteLength!==part.length||actualSha!==part.sha256)throw Error(`shamela_search_v2_packed_slice_corrupt:${part.project}/${part.archive}:${part.offset}:${part.length}:${part.sha256}:${actualSha}:${bytes.byteLength}`)
    return bytes
  }
}

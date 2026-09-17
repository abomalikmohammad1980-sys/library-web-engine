import {batchHeadingRanges} from './heading_range_batch'
interface PartitionLocation {path:string;offset:number;bytes:number;packBytes:number}
/** Version only same-origin, bounded API ranges; static packs and unrelated
 * requests keep their existing URL. Integrity checks remain in the consumer. */
export function headingRangeTransportURL(url:URL,baseURI:string,init?:RequestInit):URL{
 const range=new Headers(init?.headers).get('Range')?.match(/^bytes=(\d{1,10})-(\d{1,10})$/)
 if(url.origin!==new URL(baseURI).origin||url.search||!range||!/^\/api\/search\/headings\/[a-f0-9]{64}\/(?:rows|postings|pointers|dictionary)\/[a-f0-9]{64}\.(?:json|bin|json\.gz|compact\.bin\.gz)$/.test(url.pathname))return url
 const start=Number(range[1]),end=Number(range[2])
 if(end<start||end-start+1>1048576)return url
 const versioned=new URL(url);versioned.search='?transport=range-v2';return versioned
}
/** Range transport only; the search client still verifies each original gzip
 * shard's SHA-256. Packing never changes dictionary contents or coverage. */
export async function fetchPackedHeadingPartition(url:URL,location:PartitionLocation,init:RequestInit|undefined,fetcher:typeof fetch=fetch):Promise<Response>{
 const headers=new Headers(init?.headers),requested=headers.get('Range'),match=requested?.match(/^bytes=(\d+)-(\d+)$/)
 if(requested&&!match)throw Error('heading_partition_range_invalid')
 const from=match?Number(match[1]):0,to=match?Number(match[2]):location.bytes-1
 if(from<0||to<from||to>=location.bytes)throw Error('heading_partition_range_invalid')
 const start=location.offset+from,end=location.offset+to
 headers.set('Range',`bytes=${start}-${end}`)
 const response=await fetcher(url,{...init,headers})
 if(response.status===206&&response.headers.get('content-range')!==`bytes ${start}-${end}/${location.packBytes}`)throw Error('heading_partition_range_mismatch')
 if(!response.ok)return response
 // Some local/static servers ignore Range. Accept only the complete expected
 // pack and isolate the requested bytes before the client's hash verification.
 const bytes=new Uint8Array(await response.arrayBuffer())
 if(bytes.length!==(response.status===206?end-start+1:location.packBytes))throw Error('heading_partition_pack_size')
 const body=response.status===206?bytes:bytes.slice(start,end+1)
 return new Response(body,{status:requested?206:200,headers:{'content-type':'application/octet-stream','content-length':String(body.length),...(requested?{'content-range':`bytes ${from}-${to}/${location.bytes}`}:{})}})
}
/** Only dictionary partitions use static assets; rows/postings retain the verified API. */
export async function headingDictionaryOptions(baseURI:string,batchRanges=true){
 const batchedFetch=batchRanges?batchHeadingRanges(fetch):fetch
 const {default:release}=await import('./heading_dictionary_release.generated.json')
 const paths=new Set(release.parts.shards.map(shard=>shard.path))
 const fetcher:typeof fetch=(input,init)=>{
  const url=new URL(String(input)),path=url.pathname.split('/').slice(-2).join('/')
  if(!paths.has(path))return batchedFetch(headingRangeTransportURL(url,baseURI,init),init)
  const location=(release as unknown as {locations:Record<string,PartitionLocation>}).locations[path]
  if(!location)throw Error('heading_partition_location_missing')
  return fetchPackedHeadingPartition(new URL(location.path,new URL(release.baseURL,baseURI)),location,init,batchedFetch)
 }
 return {dictionaryPartitions:{...release.parts,contract:'khizana-heading-trigrams/2' as const},fetch:fetcher}
}

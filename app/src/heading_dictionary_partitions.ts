export interface HeadingDictionaryPartition {path:string;bytes:number;sha256:string;gzipBytes:number;gzipSha256:string;wordCount:number}
export interface HeadingDictionaryPartitions {contract:'khizana-heading-trigrams/1'|'khizana-heading-trigrams/2';sourceManifestSha256:string;sourceDictionarySha256:string;shards:HeadingDictionaryPartition[]}
export function headingGramBuckets(word:string,count:number):number[]{
 const buckets=new Set<number>()
 for(let at=0;at+3<=word.length;at++){let hash=2166136261;for(let i=at;i<at+3;i++)hash=Math.imul(hash^word.charCodeAt(i),16777619);buckets.add((hash>>>0)%count)}
 return [...buckets]
}
/** Every containing word is in every gram bucket. Pick the smallest bucket;
 * collisions add candidates, never remove matches. Short terms retain full index. */
export function selectHeadingPartitions(terms:readonly string[],parts:HeadingDictionaryPartitions):number[]|undefined{
 if(!['khizana-heading-trigrams/1','khizana-heading-trigrams/2'].includes(parts.contract)||parts.shards.length!==512)throw Error('heading_search_integrity')
 if(!terms.length||terms.some(term=>term.length<3))return undefined
 const result=new Set<number>()
 for(const term of terms){const buckets=headingGramBuckets(term,512);buckets.sort((a,b)=>parts.shards[a]!.gzipBytes-parts.shards[b]!.gzipBytes);result.add(buckets[0]!)}
 return result.size>16?undefined:[...result]
}

import {PackedTermDirectoryMerkle,type MerkleDescriptor} from './packed_term_directory_merkle'
type Counts={segments:number;expectedSegments:number;books:number;documents:number;positions:number}
type Context={manifest:{releaseId:string;coverageComplete:boolean;counts:Counts;termCount?:number};manifestSha256:string;controlBaseUrl:string;fetch:typeof fetch;onBytes?:(bytes:number)=>void}
const SHA=/^[a-f0-9]{64}$/
const invalid=():never=>{throw Error('shamela_search_v2_merkle_optin_invalid')}
/** This option belongs to the trusted application release config, NOT to a
 * descriptor fetched beside a leaf. Complete readback is a release admission
 * assertion; this client does not pretend to perform that full remote audit. */
export function snapshotMerkleOptIn(value:unknown):unknown{
 if(value===undefined)return undefined
 try{return JSON.parse(JSON.stringify(value))}catch{return invalid()}
}
export async function createTrustedMerkleDirectory(raw:unknown,context:Context):Promise<PackedTermDirectoryMerkle|undefined>{
 if(raw===undefined)return undefined
 const option=snapshotMerkleOptIn(raw) as {contract?:string;descriptorJson?:string;descriptorSha256?:string;readback?:{contract:string;descriptorSha256:string;verifiedLeaves:number;expectedLeaves:number;complete:boolean}}
 const manifest=JSON.parse(JSON.stringify(context.manifest)) as Context['manifest'],sourceSha=context.manifestSha256,base=context.controlBaseUrl,fetcher=context.fetch,onBytes=context.onBytes
 if(!option||option.contract!=='khizana-packed-merkle-optin/1'||typeof option.descriptorJson!=='string'||new TextEncoder().encode(option.descriptorJson).length>8192||typeof option.descriptorSha256!=='string'||!SHA.test(option.descriptorSha256))return invalid()
 const readback=option.readback
 if(!readback||readback.contract!=='khizana-merkle-complete-readback/1'||readback.complete!==true||readback.expectedLeaves!==16384||readback.verifiedLeaves!==16384||readback.descriptorSha256!==option.descriptorSha256)return invalid()
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(option.descriptorJson)))].map(b=>b.toString(16).padStart(2,'0')).join('')
 if(digest!==option.descriptorSha256)return invalid()
 let descriptor:MerkleDescriptor
 try{descriptor=JSON.parse(option.descriptorJson)}catch{return invalid()}
 if(!descriptor||!SHA.test(sourceSha)||descriptor.sourceManifestSha256!==sourceSha||descriptor.releaseId!==manifest.releaseId||descriptor.coverageComplete!==true||manifest.coverageComplete!==true||!Number.isSafeInteger(manifest.termCount)||descriptor.termCount!==manifest.termCount||!descriptor.sourceCoverage||(['segments','expectedSegments','books','documents','positions'] as const).some(key=>descriptor.sourceCoverage[key]!==manifest.counts?.[key]))return invalid()
 const url=new URL(base)
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)return invalid()
 const baseUrl=`${base.replace(/\/$/u,'')}/term-directory-merkle/${option.descriptorSha256}`
 return new PackedTermDirectoryMerkle({baseUrl,descriptor,releaseId:manifest.releaseId,fetch:async(input,init)=>{
  const response=await fetcher(input,init)
  if(!response.body||!onBytes)return response
  return new Response(response.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){onBytes(chunk.byteLength);controller.enqueue(chunk)}})),{status:response.status,statusText:response.statusText,headers:response.headers})
 }})
}

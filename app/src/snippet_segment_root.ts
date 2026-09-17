import {decodeSnippetDirectoryRoot,type SnippetDirectoryDescriptor} from './snippet_directory_root'
export interface SnippetSegmentDescriptor {segment:string;path:string;sha256:string;byteLength:number;directories:number;rows:number}
const hash=/^[a-f0-9]{64}$/
const count=(value:unknown,min=0)=>Number.isSafeInteger(value)&&Number(value)>=min
export async function decodeSnippetSegmentRoot(bytes:Uint8Array,expected:{releaseId:string;sourceManifestSha256:string;sha256:string;byteLength:number},sha:(bytes:Uint8Array)=>Promise<string>):Promise<Map<string,SnippetSegmentDescriptor>>{
 if(!count(expected.byteLength,1)||expected.byteLength>4*1024*1024||bytes.length!==expected.byteLength||!hash.test(expected.sha256)||!hash.test(expected.sourceManifestSha256)||await sha(bytes)!==expected.sha256)throw Error('snippet_segments_integrity')
 const root=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
 if(root?.contract!=='snippet-segment-root/1'||root.releaseId!==expected.releaseId||root.sourceManifestSha256!==expected.sourceManifestSha256||!Array.isArray(root.segments)||root.segments.length>20000||!count(root.directories)||!count(root.rows))throw Error('snippet_segments_identity')
 const result=new Map<string,SnippetSegmentDescriptor>();let directories=0,rows=0
 for(const item of root.segments){
  if(!item||typeof item.segment!=='string'||!/^[a-zA-Z0-9_-]+$/.test(item.segment)||item.path!==`segment-roots/${item.segment}.json`||result.has(item.segment)||typeof item.sha256!=='string'||!hash.test(item.sha256)||!count(item.byteLength,1)||item.byteLength>4*1024*1024||!count(item.directories,1)||item.directories>20000||!count(item.rows))throw Error('snippet_segments_descriptor')
  result.set(item.segment,{segment:item.segment,path:item.path,sha256:item.sha256,byteLength:item.byteLength,directories:item.directories,rows:item.rows});directories+=item.directories;rows+=item.rows
 }
 if(!Number.isSafeInteger(directories)||!Number.isSafeInteger(rows)||directories!==root.directories||rows!==root.rows)throw Error('snippet_segments_totals')
 return result
}
/** Pins come from the already verified top-level root, never from fetched content. */
export async function decodeSnippetSegmentDirectories(bytes:Uint8Array,descriptor:SnippetSegmentDescriptor,releaseId:string,sha:(bytes:Uint8Array)=>Promise<string>):Promise<Map<string,SnippetDirectoryDescriptor>>{
 if(bytes.length!==descriptor.byteLength)throw Error('snippet_segment_length')
 const directories=await decodeSnippetDirectoryRoot(bytes,{sha256:descriptor.sha256,releaseId},sha)
 if(directories.size!==descriptor.directories)throw Error('snippet_segment_count')
 for(const path of directories.keys())if(!path.startsWith(`segments/${descriptor.segment}/snippets/`))throw Error('snippet_segment_scope')
 return directories
}

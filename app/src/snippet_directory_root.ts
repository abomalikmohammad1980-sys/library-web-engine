export interface SnippetDirectoryDescriptor {path:string;sha256:string;byteLength:number}
export async function readSnippetDirectoryRoot(response:Response,expected:{sha256:string;releaseId:string;byteLength:number},sha:(bytes:Uint8Array)=>Promise<string>,signal?:AbortSignal){
 if(response.status!==200||!response.body||!Number.isSafeInteger(expected.byteLength)||expected.byteLength<1||expected.byteLength>4*1024*1024){await response.body?.cancel();throw Error('snippet_root_response')}
 const reader=response.body.getReader(),bytes=new Uint8Array(expected.byteLength);let offset=0
 const abort=()=>{void reader.cancel().catch(()=>undefined)}
 signal?.addEventListener('abort',abort,{once:true})
 try{
  signal?.throwIfAborted()
  for(;;){const {done,value}=await reader.read();signal?.throwIfAborted();if(done)break;if(offset+value.length>bytes.length)throw Error('snippet_root_length');bytes.set(value,offset);offset+=value.length}
  if(offset!==bytes.length)throw Error('snippet_root_length')
  const result=await decodeSnippetDirectoryRoot(bytes,expected,sha);signal?.throwIfAborted();return result
 }finally{signal?.removeEventListener('abort',abort);await reader.cancel();reader.releaseLock()}
}
/** The root fingerprint must be pinned by the release, not supplied by this response. */
export async function decodeSnippetDirectoryRoot(bytes:Uint8Array,expected:{sha256:string;releaseId:string},sha:(bytes:Uint8Array)=>Promise<string>):Promise<Map<string,SnippetDirectoryDescriptor>>{
 if(bytes.length>4*1024*1024||!/^[a-f0-9]{64}$/.test(expected.sha256)||await sha(bytes)!==expected.sha256)throw Error('snippet_root_integrity')
 const root=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
 if(root?.contract!=='snippet-directory-root/1'||root.releaseId!==expected.releaseId||!Array.isArray(root.directories)||root.directories.length>20000)throw Error('snippet_root_identity')
 const result=new Map<string,SnippetDirectoryDescriptor>()
 for(const row of root.directories){
  if(!row||typeof row.path!=='string'||!/^segments\/[a-zA-Z0-9_-]+\/snippets\/[a-zA-Z0-9_-]+\.json$/.test(row.path)||result.has(row.path)||typeof row.sha256!=='string'||!/^[a-f0-9]{64}$/.test(row.sha256)||!Number.isSafeInteger(row.byteLength)||row.byteLength<1||row.byteLength>2*1024*1024)throw Error('snippet_root_descriptor')
  result.set(row.path,{path:row.path,sha256:row.sha256,byteLength:row.byteLength})
 }
 return result
}

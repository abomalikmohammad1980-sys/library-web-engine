export type HeadingRowBundles={contract:'khizana-heading-row-bundles/1';root:string;sourceManifestSha256:string;rowCount:number;rowsPerBundle:256;baseURL:string}
const shaPattern=/^[a-f0-9]{64}$/
const bad=()=>new Error('heading_search_integrity')
export function validateRowBundles(d:HeadingRowBundles,sourceHash?:string){
 if(d.contract!=='khizana-heading-row-bundles/1'||!shaPattern.test(d.root)||d.sourceManifestSha256!==sourceHash||!shaPattern.test(d.sourceManifestSha256)||d.rowsPerBundle!==256||!Number.isSafeInteger(d.rowCount)||d.rowCount<1)throw bad()
}
const hash=async(bytes:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.slice().buffer))].map(n=>n.toString(16).padStart(2,'0')).join('')
export async function decodeRowBundle(text:string,index:number,d:HeadingRowBundles):Promise<unknown[][]>{
 const count=Math.ceil(d.rowCount/d.rowsPerBundle)
 if(!Number.isSafeInteger(index)||index<0||index>=count||text.length>4194304)throw bad()
 const {payload,proof}=JSON.parse(text)
 if(typeof payload!=='string'||!Array.isArray(proof)||proof.length!==Math.ceil(Math.log2(count))||proof.some(p=>typeof p!=='string'||!shaPattern.test(p)))throw bad()
 const bytes=new TextEncoder().encode(payload);if(bytes.length>2097152)throw bad()
 const leaf=new Uint8Array(bytes.length+1);leaf.set(bytes,1);let current=await hash(leaf),at=index
 for(const sibling of proof){const pair=at%2?[sibling,current]:[current,sibling],bytes=new Uint8Array(65);bytes[0]=1;pair.forEach((s,k)=>{for(let i=0;i<32;i++)bytes[1+k*32+i]=parseInt(s.slice(i*2,i*2+2),16)});current=await hash(bytes);at=Math.floor(at/2)}
 if(current!==d.root)throw bad()
 const data=JSON.parse(payload),expected=Math.min(d.rowsPerBundle,d.rowCount-index*d.rowsPerBundle)
 if(data.firstRow!==index*d.rowsPerBundle||!Array.isArray(data.rows)||data.rows.length!==expected||data.rows.some((r:unknown)=>!Array.isArray(r)||r.length!==9))throw bad()
 return data.rows
}

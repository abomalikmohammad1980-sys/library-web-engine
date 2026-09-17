/** Browser-safe readers for pinned recovery assets. No release is enabled here. */
export type RecoveryRow=[string,string,number,string,string,number|null,number|null,string,string|null]
export type RecoveryDescriptor={path:string;sha256:string;byteLength:number;rows:number}
export type RecoveryPin={sourceManifestSha256:string;sha256:string;byteLength:number}
type Digest=(bytes:Uint8Array)=>Promise<string>
const hash=/^[a-f0-9]{64}$/
const integer=(value:unknown,min=0):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min
const fail=(reason:string):never=>{throw Error(`snippet_recovery_${reason}`)}
async function checked(bytes:Uint8Array,pin:{sha256:string;byteLength:number},max:number,digest:Digest){
 if(!hash.test(pin.sha256)||!integer(pin.byteLength,1)||pin.byteLength>max||bytes.byteLength!==pin.byteLength||await digest(bytes)!==pin.sha256)fail('integrity')
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
}
export async function decodeRecoveryManifest(bytes:Uint8Array,pin:RecoveryPin&{auditSha256:string;rows:number},digest:Digest):Promise<Map<string,RecoveryDescriptor>>{
 const value=await checked(bytes,pin,4*1024*1024,digest)
 if(!hash.test(pin.sourceManifestSha256)||!hash.test(pin.auditSha256)||!integer(pin.rows)||value?.contract!=='snippet-source-recovery-manifest/1'||value.sourceManifestSha256!==pin.sourceManifestSha256||value.auditSha256!==pin.auditSha256||value.rows!==pin.rows||value.unresolvedExtraRows!==0||!Array.isArray(value.files)||value.files.length>20000)fail('manifest')
 const files=new Map<string,RecoveryDescriptor>();let rows=0
 for(const file of value.files){
  if(!file||typeof file.path!=='string'||!/^books\/\d+\.json$/.test(file.path)||typeof file.sha256!=='string'||!hash.test(file.sha256)||!integer(file.byteLength,1)||file.byteLength>2*1024*1024||!integer(file.rows,1))fail('descriptor')
  const id=file.path.slice(6,-5);if(files.has(id))fail('duplicate_book')
  files.set(id,{path:file.path,sha256:file.sha256,byteLength:file.byteLength,rows:file.rows});rows+=file.rows
 }
 if(!Number.isSafeInteger(rows)||rows!==pin.rows)fail('row_count')
 return files
}
export async function decodeRecoveredRows(bytes:Uint8Array,descriptor:RecoveryDescriptor,bookId:string,sourceManifestSha256:string,digest:Digest):Promise<Map<string,RecoveryRow>>{
 const value=await checked(bytes,descriptor,2*1024*1024,digest)
 if(!/^\d+$/.test(bookId)||!hash.test(sourceManifestSha256)||descriptor.path!==`books/${bookId}.json`||!integer(descriptor.rows,1)||value?.contract!=='snippet-source-recovery/1'||value.sourceManifestSha256!==sourceManifestSha256||!Array.isArray(value.entries)||value.entries.length!==descriptor.rows)fail('book')
 const rows=new Map<string,RecoveryRow>()
 for(const row of value.entries){
  // Negative death years represent pre-Hijra authors and must retain their sign.
  if(!Array.isArray(row)||row.length!==9||row[1]!==bookId||!integer(row[2])||row[0]!==`${bookId}:${row[2]}`||typeof row[3]!=='string'||!row[3].trim()||typeof row[4]!=='string'||(row[5]!==null&&!Number.isSafeInteger(row[5]))||(row[6]!==null&&!integer(row[6]))||typeof row[7]!=='string'||(row[8]!==null&&typeof row[8]!=='string')||rows.has(row[0]))fail('row')
  rows.set(row[0],row as RecoveryRow)
 }
 return rows
}
export async function decodeSourceCorrections(bytes:Uint8Array,pin:RecoveryPin&{documents:number;positions:number},digest:Digest):Promise<{excluded:ReadonlySet<string>;documents:number;positions:number}>{
 const value=await checked(bytes,pin,2*1024*1024,digest)
 if(!hash.test(pin.sourceManifestSha256)||!integer(pin.documents)||!integer(pin.positions)||value?.contract!=='search-source-corrections/1'||value.sourceManifestSha256!==pin.sourceManifestSha256||!Array.isArray(value.excludedDocuments)||value.excludedDocuments.length>20000||!hash.test(value.evidenceSha256??''))fail('correction')
 const excluded=new Set<string>();let removed=0
 for(const row of value.excludedDocuments){
  if(!row||typeof row.id!=='string'||!/^\d+:\d+$/.test(row.id)||excluded.has(row.id)||row.reason!=='image-only-raw-markup'||!hash.test(row.sourceBookSha256??'')||!hash.test(row.rawSha256??'')||!integer(row.positions,1))fail('exclusion')
  excluded.add(row.id);removed+=row.positions
 }
 if(!Number.isSafeInteger(removed)||value.documents!==pin.documents-excluded.size||value.positions!==pin.positions-removed||!integer(value.documents)||!integer(value.positions))fail('correction_count')
 return {excluded,documents:value.documents,positions:value.positions}
}

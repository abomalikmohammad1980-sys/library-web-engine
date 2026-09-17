import {readPublicBookIndexReceipt} from './_public-book-index-jobs.js'
import {validatePdfClassification} from './_public-book-pdf-policy.js'
export async function readVerifiedPublicBookIndex(env,id){
 if(typeof id!=='string'||!id||id.length>200)return null
 try{
  const receipt=await readPublicBookIndexReceipt(env.VISITORS_DB,id,env)
  if(!receipt||! /^[a-f0-9]{64}$/.test(receipt.manifest_sha256)||receipt.artifact_key!==`public-book-index/v1/${receipt.manifest_sha256}.json`)return null
  const object=await env.LIBRARY_R2.get(receipt.artifact_key)
  if(!object||!Number.isSafeInteger(object.size)||object.size<1||object.size>16*1024*1024)return null
  const chunks=[],reader=object.body.getReader();let size=0
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>object.size)return null;chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
  if(size!==object.size)return null
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('')
  if(hash!==receipt.manifest_sha256)return null
  const artifact=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
  if(artifact.contract!=='public-book-index/1'||artifact.bookId!==id||artifact.generation!==receipt.generation||artifact.parserVersion!==receipt.parser_version||artifact.coverageMode!==receipt.coverage_mode||!['text-and-headings','pdf-bookmarks-only'].includes(artifact.coverageMode)||! /^[a-f0-9]{64}$/.test(artifact.sourceSha256??'')||typeof artifact.title!=='string'||typeof artifact.author!=='string'||!Array.isArray(artifact.rows)||!Array.isArray(artifact.headings)||artifact.rows.length>100000||artifact.headings.length>100000)return null
  if(artifact.pdfClassification)validatePdfClassification(artifact.pdfClassification,artifact.sourceSha256)
  if(artifact.coverageMode==='pdf-bookmarks-only'&&artifact.rows.length)return null
  if(artifact.rows.some(r=>typeof r?.text!=='string')||artifact.headings.some(h=>typeof h?.value!=='string'))return null
  const current=await readPublicBookIndexReceipt(env.VISITORS_DB,id,env)
  if(!current||current.generation!==receipt.generation||current.manifest_sha256!==hash)return null
  return artifact
 }catch{return null}
}

import {expect,it} from 'vitest'
import {ShamelaSearchV2Client} from './shamela_search_v2'
it('does not serialize candidates while looking for the final result on a page',async()=>{
 const client=new ShamelaSearchV2Client() as any,query='الف سلعة'
 const candidates=Array.from({length:192},(_,i)=>[`${i+1}:0`,[0],i,'segment'])
 client.getPackedManifest=async()=>({termIndexPattern:'terms/{bucket}.json',termIndexBucketCount:1})
 client.merkleDirectory=async()=>undefined;client.liteDirectory=()=>undefined
 client.packedTermEntry=async(word:string)=>({byteLength:word==='سلعة'?100:300*1024*1024})
 client.packedTermValue=async()=>['سلعة',candidates]
 let active=0,tailMax=0
 client.snippetRows=async(_path:string,wanted:Set<string>)=>{
  active++;if([...wanted].some(id=>Number(id.split(':')[0])>64))tailMax=Math.max(tailMax,active)
  await new Promise(done=>setTimeout(done,0));active--
  return [...wanted].map(id=>[id,id.split(':')[0],0,id==='1:0'?Array(99).fill(query).join(' '):id==='192:0'?query:'نص آخر'])
 }
 const result=await client.selectivePackedPhrase(query,['الف','سلعة'],{postingPattern:'postings/{bucket}',postingBucketCount:1,segmentSnippetPattern:'segments/{segment}/{bucket}',bucketCount:512,counts:{books:8594}},()=>true,0,100,0)
 expect(result.hits).toHaveLength(100);expect(result.hits.at(-1).id).toBe('192:0');expect(tailMax).toBeGreaterThan(20)
})

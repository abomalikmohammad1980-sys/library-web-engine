// Operator-only SQL preparation, NOT an HTTP endpoint or an activation command.
import {readFile,realpath,writeFile} from 'node:fs/promises'
import {createReadStream} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolve,relative,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
const sha=x=>createHash('sha256').update(x).digest('hex'),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)
const portable=x=>typeof x==='string'&&!x.startsWith('/')&&!x.includes('\\')&&x.split('/').every(p=>p&&p!=='.'&&p!=='..')
const sql=x=>`'${String(x).replaceAll("'","''")}'`
export async function prepareVerifiedBokRegistration({transactionRoot,candidatePath,cloudReceiptPath,output}){
 const root=await realpath(transactionRoot),raw=await readFile(resolve(root,'transaction.json')),transaction=JSON.parse(raw),candidate=JSON.parse(await readFile(candidatePath,'utf8')),receiptRaw=await readFile(cloudReceiptPath),receipt=JSON.parse(receiptRaw)
 const releaseId=sha(raw),candidateSha256=sha(JSON.stringify(candidate))
 if(transaction.contract!=='bok-publication-transaction/1'||transaction.packedArtifactsVerified!==true||!Array.isArray(transaction.files)||transaction.files.length<1||transaction.files.length>100000||candidate.contract!=='bok-text-release/1'||candidate.bookId!==String(410000000+Number(transaction.bookId))||!hash(candidate.sourceHash))throw Error('bok_registration_contract')
 // A two-book acceptance receipt can NEVER authorize a full-library release.
 if(receipt.contract!=='bok-production-cloud-acceptance/1'||receipt.passed!==true||receipt.fullLibrary!==true||receipt.transactionSha256!==releaseId||receipt.candidateSha256!==candidateSha256||receipt.readerSearchAnnotations!==true||receipt.accountTestMode!==false||!Number.isSafeInteger(receipt.expectedBooks)||receipt.expectedBooks<8594)throw Error('bok_registration_cloud_gate')
 const paths=new Set()
 for(const entry of transaction.files){
  if(!portable(entry.file)||!hash(entry.sha256)||!Number.isSafeInteger(entry.byteLength)||entry.byteLength<0||paths.has(entry.file))throw Error('bok_registration_inventory')
  paths.add(entry.file)
  const path=await realpath(resolve(root,entry.file)),rel=relative(root,path);if(rel==='..'||rel.startsWith('..'+sep)||resolve(root,entry.file)!==path)throw Error('bok_registration_path')
  let bytes=0;const digest=createHash('sha256');for await(const chunk of createReadStream(path)){bytes+=chunk.length;if(bytes>entry.byteLength)throw Error('bok_registration_bytes');digest.update(chunk)}
  if(bytes!==entry.byteLength||digest.digest('hex')!==entry.sha256)throw Error('bok_registration_sha')
 }
 const role=(name)=>{const matches=transaction.files.filter(f=>f.role===name);if(matches.length!==1)throw Error('bok_registration_role');return matches[0]}
 const reader=role('reader-manifest'),packed=role('packed-manifest')
 if(reader.file!=='reader/manifest.json'||packed.file!=='packed/control/manifest.json')throw Error('bok_registration_layout')
 const manifest=JSON.parse(await readFile(resolve(root,packed.file),'utf8'))
 if(manifest.contract!=='shamela-search-v2/packed-manifest-1'||manifest.fixtureOnly||manifest.coverageComplete!==true||manifest.counts.books!==receipt.expectedBooks||manifest.projectCount!==8||manifest.releaseId!==transaction.packedReleaseId)throw Error('bok_registration_full_coverage')
 const catalogFile=role('source-catalog'),catalog=JSON.parse(await readFile(resolve(root,catalogFile.file),'utf8'))
 if(!Array.isArray(catalog.books)||catalog.books.length!==receipt.expectedBooks||new Set(catalog.books.map(b=>b.bookId)).size!==receipt.expectedBooks||catalog.books.some(b=>!hash(b.sha256)))throw Error('bok_registration_catalog_coverage')
 for(const item of [...manifest.indexFiles,...manifest.termIndexFiles])if(!transaction.files.some(f=>f.file==='packed/control/'+item.path&&f.sha256===item.sha256))throw Error('bok_registration_packed_inventory')
 for(const item of manifest.archives)if(!transaction.files.some(f=>f.file===`packed/project-${item.project}/${item.path}`&&f.sha256===item.sha256))throw Error('bok_registration_packed_inventory')
 const seen=new Set(),reviews=candidate.reviewedPages?.map(review=>{const page=candidate.pages?.find(p=>p.id===review.pageId);if(!page||typeof page.text!=='string'||!Number.isSafeInteger(review.pageId)||review.pageId<0||!Number.isSafeInteger(review.revision)||review.revision<1||!hash(review.baseHash)||seen.has(review.pageId))throw Error('bok_registration_reviews');seen.add(review.pageId);return{pageId:review.pageId,revision:review.revision,baseHash:review.baseHash,text:page.text}})
 if(!reviews?.length||reviews.length>128||Buffer.byteLength(JSON.stringify(reviews))>524288)throw Error('bok_registration_review_budget')
 // Verify the exported candidate is exactly what the corrected reader contains.
 const bookFile=role('reader-book'),book=JSON.parse(await readFile(resolve(root,bookFile.file),'utf8'))
 for(const review of reviews)if(!book.pages.some(p=>Number(p.sourceRowId)===review.pageId&&((p.body??'')+(p.foot?'\n_________\n'+p.foot:''))===review.text))throw Error('bok_registration_candidate_reader_mismatch')
 const statement=`INSERT INTO bok_verified_releases(release_id,candidate_sha256,book_id,source_hash,reader_manifest_sha256,search_manifest_sha256,artifact_root,reviews_json,cloud_receipt_sha256) VALUES(${[releaseId,candidateSha256,candidate.bookId,candidate.sourceHash,reader.sha256,packed.sha256,`/library/bok-releases/${releaseId}`,JSON.stringify(reviews),sha(receiptRaw)].map(sql).join(',')});\n`
 await writeFile(output,statement,{flag:'wx'})
 return{releaseId,candidateSha256,filesVerified:paths.size,books:manifest.counts.books,activationPerformed:false,remoteWrites:0}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [transactionRoot,candidatePath,cloudReceiptPath,output]=process.argv.slice(2)
 if(!output)throw Error('Usage: node tools/register-bok-verified-release.mjs transactionRoot candidate.json cloudReceipt.json new-output.sql')
 console.log(JSON.stringify(await prepareVerifiedBokRegistration({transactionRoot,candidatePath,cloudReceiptPath,output})))
}

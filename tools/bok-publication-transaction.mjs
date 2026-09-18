import {readFile,writeFile,mkdir,copyFile,statfs} from 'node:fs/promises'
import {constants} from 'node:fs'
import {createReadStream} from 'node:fs'
import {resolve,dirname,relative,sep} from 'node:path'
import {createHash} from 'node:crypto'
import {segmentSourceDigest,searchPolicy} from './search-normalization-contract.mjs'
const sha=value=>createHash('sha256').update(value).digest('hex')
const portable=value=>typeof value==='string'&&!value.startsWith('/')&&!value.includes('\\')&&value.split('/').every(part=>part&&part!=='.'&&part!=='..')
/** Stage ONLY immutable candidates; no production pointer or cloud mutation is supported. */
export async function stageBokPublicationTransaction({readerReleaseRoot,segmentRoot,sourceCatalogPath,baselineProof,affectedSegments,packedRoot,output}){
 const rel=relative(process.cwd(),resolve(output));if(!rel||rel==='..'||rel.startsWith('..'+sep))throw Error('bok_transaction_output_outside_workspace')
 const parse=async path=>JSON.parse(await readFile(path,'utf8'))
 const release=await parse(resolve(readerReleaseRoot,'release.json'))
 if(!portable(release.reader?.file))throw Error('bok_transaction_path')
 const reader=await parse(resolve(readerReleaseRoot,release.reader.file)),global=await parse(resolve(segmentRoot,'manifest.json')),catalog=await parse(sourceCatalogPath)
 if(release.contract!=='bok-reviewed-artifacts/1'||global.coverageComplete!==true||!affectedSegments?.length||new Set(affectedSegments).size!==affectedSegments.length)throw Error('bok_transaction_incomplete')
 if(!baselineProof?.normalizationContract||baselineProof.normalizationContract!==global.normalizationContract)throw Error('bok_transaction_normalization_mixed')
 searchPolicy(global.normalizationContract)
 const entry=reader.books.find(book=>book.bookId===release.bookId),catalogEntry=catalog.books?.find(book=>book.bookId===release.bookId)
 if(!entry||!catalogEntry||!portable(entry.file)||entry.sha256!==catalogEntry.sha256||entry.file!==catalogEntry.file)throw Error('bok_transaction_catalog_mismatch')
 const files=[]
 const digestFile=async path=>{const digest=createHash('sha256');let byteLength=0;for await(const chunk of createReadStream(path)){digest.update(chunk);byteLength+=chunk.length}return{sha256:digest.digest('hex'),byteLength}}
 const add=async(role,file,path,expectedSha)=>{if(!portable(file)||files.some(item=>item.file===file))throw Error('bok_transaction_path');const measured=await digestFile(path);if(expectedSha&&measured.sha256!==expectedSha)throw Error('bok_transaction_sha');files.push({role,file,...measured,sourcePath:path})}
 await add('reader-manifest','reader/manifest.json',resolve(readerReleaseRoot,release.reader.file),release.reader.sha256)
 await add('reader-book','reader/'+entry.file,resolve(readerReleaseRoot,'reader',entry.file),entry.sha256)
 await add('original-rollback','original.json',resolve(readerReleaseRoot,'original.json'),release.sourceSha256)
 await add('source-catalog','source-catalog.json',sourceCatalogPath)
 await add('search-manifest','search/manifest.json',resolve(segmentRoot,'manifest.json'))
 for(const route of global.routeFiles??[]){if(!portable(route.file))throw Error('bok_transaction_path');await add('search-route','search/'+route.file,resolve(segmentRoot,route.file),route.sha256)}
 let containsBook=false
 for(const id of affectedSegments){
  if(!/^batch-\d{4}-s\d{4}$/.test(id)||!global.segments.includes(id))throw Error('bok_transaction_segment_id')
  const segment=await parse(resolve(segmentRoot,'segments',id,'manifest.json'))
  if(segment.normalizationContract!==global.normalizationContract)throw Error('bok_transaction_normalization_mixed')
  const sourceEntries=segment.bookIds.map(id=>catalog.books.find(book=>book.bookId===id))
  if(sourceEntries.some(book=>!book)||segmentSourceDigest(sourceEntries,global.normalizationContract)!==segment.sourceDigestSha256)throw Error('bok_transaction_segment_source_mismatch')
  containsBook ||= segment.bookIds.includes(release.bookId)
  await add('search-segment',`search/segments/${id}/manifest.json`,resolve(segmentRoot,'segments',id,'manifest.json'))
  for(const record of [...segment.termFiles,...segment.snippetFiles]){if(!portable(record.file))throw Error('bok_transaction_path');await add('search-segment-data',`search/segments/${id}/${record.file}`,resolve(segmentRoot,'segments',id,record.file),record.sha256)}
 }
 if(!containsBook)throw Error('bok_transaction_changed_book_missing')
 let packedReleaseId
 if(packedRoot){
  const packed=await parse(resolve(packedRoot,'control/manifest.json'))
  if(packed.contract!=='shamela-search-v2/packed-manifest-1'||packed.sourceManifestSha256!==sha(await readFile(resolve(segmentRoot,'manifest.json')))||packed.coverageComplete!==true||packed.counts.books!==global.counts.books)throw Error('bok_transaction_packed_source_mismatch')
  packedReleaseId=packed.releaseId
  await add('packed-manifest','packed/control/manifest.json',resolve(packedRoot,'control/manifest.json'))
  for(const item of [...packed.indexFiles,...packed.termIndexFiles]){if(!portable(item.path))throw Error('bok_transaction_path');await add('packed-directory','packed/control/'+item.path,resolve(packedRoot,'control',item.path),item.sha256)}
  for(const item of packed.archives){if(!portable(item.path)||!Number.isSafeInteger(item.project)||item.project<0||item.project>=packed.projectCount)throw Error('bok_transaction_path');await add('packed-archive',`packed/project-${item.project}/${item.path}`,resolve(packedRoot,`project-${item.project}`,item.path),item.sha256)}
 }
 // Check disk capacity before copying a full-library transaction. Streaming removes
 // the former 512MiB memory ceiling, but must not fill the workspace volume.
 const volume=await statfs(process.cwd(),{bigint:true}),required=files.reduce((n,item)=>n+BigInt(item.byteLength),0n)
 if(volume.bavail*volume.bsize<required+1024n*1024n*1024n)throw Error('bok_transaction_insufficient_disk')
 // Source raw bytes are read and validated BEFORE creating a transaction directory.
 await mkdir(output,{recursive:false})
 for(const item of files){const path=resolve(output,item.file);await mkdir(dirname(path),{recursive:true});await copyFile(item.sourcePath,path,constants.COPYFILE_EXCL);const measured=await digestFile(path);if(measured.sha256!==item.sha256||measured.byteLength!==item.byteLength)throw Error('bok_transaction_source_changed')}
 const manifest={contract:'bok-publication-transaction/1',bookId:release.bookId,normalizationContract:global.normalizationContract,baseline:baselineProof,affectedSegments,...packedReleaseId?{packedReleaseId,packedArtifactsVerified:true}:{},files:files.map(({sourcePath,...entry})=>entry),productionEnabled:false,activationEligible:false,requiredFinalGates:[...packedRoot?[]:['merge-global-postings-and-packed-term-directory','verify-all-staged-and-reused-artifacts'],'server-editor-authorization-and-revision-recheck','cloud-preview-reader-search-annotations-acceptance'],rollback:{originalSha256:release.sourceSha256,packedReleaseId:baselineProof.packedReleaseId??null},deletions:[]}
 await writeFile(resolve(output,'transaction.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'})
 return manifest
}

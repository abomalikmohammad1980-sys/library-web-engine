import {readFile,writeFile,mkdir,stat} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {gzipSync} from 'node:zlib'
import {PIN,ARTIFACT} from './field-overlay-upload-plan.mjs'
import {fieldSourceRanges} from './field-source-json-ranges.mjs'
const sha=value=>createHash('sha256').update(value).digest('hex'),root=process.cwd()
if(process.argv[2]!=='--all')throw Error('explicit_build_required')
const overlayRoot=resolve(root,ARTIFACT),manifestBytes=await readFile(resolve(overlayRoot,'manifest.json'))
if(sha(manifestBytes)!==PIN)throw Error('overlay_pin')
const manifest=JSON.parse(manifestBytes),out=resolve(root,`.artifacts/field-source-ranges-${PIN}`)
await mkdir(resolve(out,'books'),{recursive:true})
const books=[];let documents=0,bytes=0
for(const entry of manifest.books){
 const batch=entry.segmentId.split('-s')[0],sourcePath=resolve(root,'../../بيانات-المشروع/shamela/published-corpus-v1',batch,'books',entry.bookId+'.json')
 const raw=await readFile(sourcePath);if(sha(raw)!==entry.sourceBookSha256)throw Error('source_pin:'+entry.bookId)
 const boundaryBytes=await readFile(resolve(overlayRoot,entry.file));if(sha(boundaryBytes)!==entry.sha256)throw Error('boundary_pin')
 const rows=fieldSourceRanges(raw,entry.bookId,JSON.parse(boundaryBytes).rows)
 if(rows.length!==entry.documents)throw Error('source_count')
 const sourcePathPublic=`/library/shamela/batches/${batch}/books/${entry.bookId}.json`
 const expanded=Buffer.from(JSON.stringify({contract:'khizana-field-source-ranges-book/1',overlaySha256:PIN,bookId:entry.bookId,sourceBookSha256:entry.sourceBookSha256,sourceBytes:raw.length,sourcePath:sourcePathPublic,rows})+'\n')
 if(expanded.length>32*1024*1024)throw Error('source_index_expanded_size')
 const payload=gzipSync(expanded),indexFile=`books/${entry.bookId}.json.gz`,target=resolve(out,indexFile)
 try{if((await stat(target)).size!==payload.length||sha(await readFile(target))!==sha(payload))throw Error('immutable_source_mismatch')}catch(error){if(error.code!=='ENOENT')throw error;await writeFile(target,payload,{flag:'wx'})}
 books.push({bookId:entry.bookId,indexFile,indexBytes:payload.length,indexSha256:sha(payload),expandedBytes:expanded.length,sourcePath:sourcePathPublic,sourceBytes:raw.length,sourceBookSha256:entry.sourceBookSha256,documents:entry.documents})
 documents+=entry.documents;bytes+=payload.length
 if(books.length%100===0)console.log(JSON.stringify({sourceRangeBooks:books.length,total:manifest.books.length,documents,bytes}))
}
if(documents!==manifest.counts.documents)throw Error('source_document_coverage')
const descriptor={contract:'khizana-field-source-ranges/1',overlaySha256:PIN,sourceIndexSha256:manifest.sourceIndexSha256,complete:true,counts:{books:books.length,documents,bytes},books}
const encoded=Buffer.from(JSON.stringify(descriptor)+'\n')
await writeFile(resolve(out,'manifest.json'),encoded,{flag:'wx'})
console.log(JSON.stringify({out,complete:true,sha256:sha(encoded),...descriptor.counts}))

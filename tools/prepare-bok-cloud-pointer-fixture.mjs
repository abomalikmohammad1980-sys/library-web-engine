import {readFile,writeFile,mkdir,cp} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const root='.artifacts/bok-cloud-acceptance-20260917',source='.artifacts/bok-release-tests/packed-GVCKek',sha=x=>createHash('sha256').update(x).digest('hex')
const releaseId=sha('isolated document pin fixture'),artifactRoot=`/library/bok-releases/${releaseId}`
await mkdir(root+'/dist'+artifactRoot,{recursive:true})
await cp(root+'/dist/fixture/new',root+'/dist'+artifactRoot+'/packed',{recursive:true})
await cp(source+'/reviewed/reader',root+'/dist'+artifactRoot+'/reader',{recursive:true})
const readerHash=sha(await readFile(source+'/reviewed/reader/manifest.json')),searchHash=sha(await readFile(root+'/dist/fixture/new/control/manifest.json'))
// Fixture state only, not the production registration path or a production receipt.
await writeFile(root+'/pin-fixture.sql',`INSERT INTO bok_verified_releases(release_id,candidate_sha256,book_id,source_hash,reader_manifest_sha256,search_manifest_sha256,artifact_root,reviews_json,cloud_receipt_sha256) VALUES('${releaseId}','${sha('fixture candidate')}','isolated-reader-fixture','${sha('fixture source')}','${readerHash}','${searchHash}','${artifactRoot}','[]','${sha('fixture not a production receipt')}');
UPDATE bok_release_pointer SET release_id='${releaseId}',generation=2 WHERE scope='library';\n`,{flag:'wx'})
console.log(JSON.stringify({prepared:true,releaseId,artifactRoot,syntheticOnly:true}))

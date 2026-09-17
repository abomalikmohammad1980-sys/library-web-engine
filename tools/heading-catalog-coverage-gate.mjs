import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'

export async function checkHeadingCatalogCoverage(root){
 const json=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'))
 const [catalog,primary,extra]=await Promise.all([json('app/public/data/shamela-catalog.snapshot.json'),json('app/public/data/heading-release.json'),json('app/src/heading_catalog_supplement.generated.json')])
 const expected=catalog.batches.flatMap(batch=>batch.books.map(book=>book.bookId)),actual=[...primary.coveredSourceBookIds,...extra.sourceBookIds]
 if(new Set(actual).size!==actual.length||JSON.stringify([...expected].sort())!==JSON.stringify([...actual].sort()))throw Error('heading_catalog_coverage_incomplete')
 const directory=resolve(root,'app/public',extra.baseURL),bytes=await readFile(resolve(directory,'manifest.json'))
 if(bytes.length!==extra.manifestBytes||createHash('sha256').update(bytes).digest('hex')!==extra.manifestSha256)throw Error('heading_catalog_manifest_integrity')
 const manifest=JSON.parse(bytes)
 if(!manifest.coverageComplete||manifest.bookCount!==extra.sourceBookIds.length||manifest.rowCount!==extra.rowCount)throw Error('heading_catalog_counts')
 const packs=new Map()
 for(const asset of [...manifest.rows,...manifest.postings,manifest.dictionary]){
  const location=extra.locations?.[asset.path]
  if(location&&!packs.has(location.path))packs.set(location.path,await readFile(resolve(directory,location.path)))
  const packed=location?packs.get(location.path):undefined
  const data=location?packed.subarray(location.offset,location.offset+location.bytes):await readFile(resolve(directory,asset.path)),expectedBytes=asset.gzipBytes??asset.bytes,expectedSha=asset.gzipSha256??asset.sha256
  if(data.length!==expectedBytes||createHash('sha256').update(data).digest('hex')!==expectedSha)throw Error('heading_catalog_asset_integrity')
 }
 return {books:actual.length,supplementBooks:extra.sourceBookIds.length,supplementRows:extra.rowCount}
}

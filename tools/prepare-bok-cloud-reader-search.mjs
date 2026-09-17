import {readFile,cp,copyFile,mkdir} from 'node:fs/promises'
import {build} from 'esbuild'
const root='.artifacts/bok-cloud-acceptance-20260917',fixture='.artifacts/bok-release-tests/packed-GVCKek'
const receipt=JSON.parse(await readFile(fixture+'/acceptance.json','utf8'))
await mkdir(root+'/dist/fixture',{recursive:true})
await cp(receipt.oldPacked,root+'/dist/fixture/old',{recursive:true})
await cp(receipt.newPacked,root+'/dist/fixture/new',{recursive:true})
await copyFile(fixture+'/reviewed/original.json',root+'/dist/fixture/original.json')
await copyFile(fixture+'/reviewed/reader/books/93.json',root+'/dist/fixture/corrected.json')
await build({entryPoints:['tools/bok-cloud-reader-search.ts'],outfile:root+'/reader-search-runner.mjs',bundle:true,format:'esm',platform:'node',target:'node22'})
console.log('Isolated two-book reader/search fixture prepared; no production assets copied.')

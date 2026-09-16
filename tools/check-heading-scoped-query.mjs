import {createServer} from 'vite'
import {readFile} from 'node:fs/promises'
const server=await createServer({configFile:'app/vite.config.ts',cacheDir:'.artifacts/vite-heading-scope-check',server:{watch:null},appType:'custom'})
try{
 const {CentralHeadingSearchClient}=await server.ssrLoadModule('/src/central_heading_search.ts')
 const {headingDictionaryOptions}=await server.ssrLoadModule('/src/heading_dictionary_release.ts')
 const descriptor=JSON.parse(await readFile('artifacts/heading-search-central-v2/client-release.json'))
 const ranges=JSON.parse(await readFile('app/src/heading_book_ranges.generated.json')).primary
 const release=JSON.parse(await readFile('app/public/data/heading-release.json'))
 // Exclude one book, reproducing the filtered route used after a withdrawal.
 const bookIds=release.coveredSourceBookIds.slice(0,-1)
 for(const useRanges of (process.argv.includes('--fixed-only')?[true]:[false,true])){
  const dictionary=await headingDictionaryOptions('https://khzanah.com/');let requests=0,rows=0
  const client=new CentralHeadingSearchClient({baseURL:new URL(release.baseURL,'https://khzanah.com').href,dictionaryBinary:descriptor.dictionaryBinary,...dictionary,planTokens:true,rowConcurrency:16,queryTimeoutMs:20000,...(useRanges?{bookRanges:ranges}:{}),fetch:(input,init)=>{requests++;if(String(input).includes('/rows/'))rows++;return dictionary.fetch(input,init)}})
  const start=performance.now()
  try{const result=await client.search(process.argv[2]??'التوحيد',{bookIds,limit:40});console.log(JSON.stringify({useRanges,elapsedMs:Math.round(performance.now()-start),requests,rowRequests:rows,total:result.total,exact:result.totalExact,hits:result.hits.length,withinScope:result.hits.every(hit=>bookIds.includes(hit.bookId))}))}
  catch(error){console.log(JSON.stringify({useRanges,elapsedMs:Math.round(performance.now()-start),requests,rowRequests:rows,error:error.message}))}
 }
}finally{await server.close()}

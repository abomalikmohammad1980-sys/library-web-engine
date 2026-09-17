// Derive an isolated preview from a frozen, reviewed candidate, never live/WIP config.
import {readFile,writeFile,mkdir,cp,stat} from 'node:fs/promises'
import {resolve,relative} from 'node:path'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
export function preview35Config(){
 return {name:'khizana-bok-acceptance-20260917',pages_build_output_dir:'./pages-dist',compatibility_date:'2026-09-17',vars:{PUBLIC_BOOK_SEARCH_ENABLED:'true',PUBLIC_BOOK_INGESTION_ENABLED:'true',HEADING_QUERY_ENABLED:'0',BOK_TEXT_EDITING_ENABLED:'0',BOK_PUBLICATION_JOBS_ENABLED:'0',BOK_RELEASE_ACTIVATION_ENABLED:'0'},d1_databases:[{binding:'VISITORS_DB',database_name:'khizana-bok-acceptance-20260917',database_id:'9133fe99-c4e1-4a1e-84f3-127735883279',migrations_dir:'./migrations'}],r2_buckets:[{binding:'LIBRARY_R2',bucket_name:'khizana-ingestion-acceptance-20260917'},{binding:'PUBLIC_LIBRARY_R2',bucket_name:'khzanah-library'}]}
}
export async function preparePreview35(candidate,preview){
 candidate=resolve(candidate);preview=resolve(preview)
 assert(relative(candidate,preview).startsWith('..')&&relative(preview,candidate).startsWith('..'),'preview_must_be_separate_sibling')
 try{await stat(preview);throw Error('preview_exists')}catch(error){if(error.code!=='ENOENT')throw error}
 const config=preview35Config()
 const packed=await readFile(resolve(candidate,'pages-dist/data/shamela-search-v2-packed.js'),'utf8')
 assert(packed.includes('/r2/khezana-search-v2-'),'packed_route_contract_changed_review_required')
 for(const path of ['functions/library/[[path]].js','functions/r2/[[path]].js']){
  const source=await readFile(resolve(candidate,path),'utf8')
  assert(source.includes('PUBLIC_LIBRARY_R2')&&source.includes('serveR2'),'missing_public_read_binding:'+path)
 }
 const html=await readFile(resolve(candidate,'pages-dist/index.html'),'utf8')
 assert(html.includes('batch35-search-candidate-config.js'),'missing_candidate_field_config')
 await mkdir(preview,{recursive:true})
 for(const path of ['pages-dist','functions','migrations'])await cp(resolve(candidate,path),resolve(preview,path),{recursive:true,errorOnExist:true,force:false})
 // No TOML, AI, Access audience, production DB, secrets or other bindings copied.
 await writeFile(resolve(preview,'wrangler.jsonc'),JSON.stringify(config,null,2),{flag:'wx'})
 return {preview,project:config.name,productionConfigUntouched:true,packedGateway:'/r2/',publicLibraryGateway:'/library/',secretsCopied:false}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const root=resolve(import.meta.dirname,'..')
 console.log(JSON.stringify(await preparePreview35(resolve(root,'.artifacts/batch35/deploy'),resolve(root,'.artifacts/batch35-isolated-preview/deploy'))))
}

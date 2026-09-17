import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {preview35Config,preparePreview35} from './prepare-batch35-preview.mjs'
test('preview config is an explicit isolated allowlist with no inherited production writes',()=>{
 const c=preview35Config()
 assert.equal(c.name,'khizana-bok-acceptance-20260917')
 assert.equal(c.d1_databases[0].database_id,'9133fe99-c4e1-4a1e-84f3-127735883279')
 assert.deepEqual(c.r2_buckets,[{binding:'LIBRARY_R2',bucket_name:'khizana-ingestion-acceptance-20260917'},{binding:'PUBLIC_LIBRARY_R2',bucket_name:'khzanah-library'}])
 assert.equal(c.vars.HEADING_QUERY_ENABLED,'0');assert.equal(c.vars.BOK_RELEASE_ACTIVATION_ENABLED,'0')
 assert.equal(c.vars.PUBLIC_BOOK_SEARCH_ENABLED,'true');assert.equal(c.vars.PUBLIC_BOOK_INGESTION_ENABLED,'true')
 assert.equal(c.ai,undefined);assert.equal(c.env,undefined);assert.equal(c.vars.ACCOUNT_ACCESS_AUD,undefined)
})
test('separate preview preserves candidate config and fails without read-only gateway overrides',async()=>{
 const root=await mkdtemp(join(tmpdir(),'khizana-preview-config-')),candidate=join(root,'candidate'),preview=join(root,'preview')
 try{
  for(const dir of ['pages-dist/data','functions/library','functions/r2','migrations'])await mkdir(join(candidate,dir),{recursive:true})
  await writeFile(join(candidate,'wrangler.toml'),'PRODUCTION CONFIG MUST STAY')
  await writeFile(join(candidate,'pages-dist/data/shamela-search-v2-packed.js'),'/r2/khezana-search-v2-')
  await writeFile(join(candidate,'pages-dist/index.html'),'<script src="/data/batch35-search-candidate-config.js"></script>')
  await writeFile(join(candidate,'functions/library/[[path]].js'),'serveR2 PUBLIC_LIBRARY_R2')
  await writeFile(join(candidate,'functions/r2/[[path]].js'),'serveR2')
  await assert.rejects(preparePreview35(candidate,preview),/missing_public_read_binding/)
  await assert.rejects(stat(preview),{code:'ENOENT'})
  await writeFile(join(candidate,'functions/r2/[[path]].js'),'serveR2 PUBLIC_LIBRARY_R2')
  const result=await preparePreview35(candidate,preview)
  assert.equal(result.productionConfigUntouched,true)
  assert.equal(await readFile(join(candidate,'wrangler.toml'),'utf8'),'PRODUCTION CONFIG MUST STAY')
  assert.deepEqual(JSON.parse(await readFile(join(preview,'wrangler.jsonc'),'utf8')),preview35Config())
  await assert.rejects(stat(join(preview,'wrangler.toml')),{code:'ENOENT'})
  await assert.rejects(preparePreview35(candidate,preview),/preview_exists/)
  await assert.rejects(preparePreview35(candidate,join(candidate,'nested')),/separate_sibling/)
 }finally{await rm(root,{recursive:true,force:true})}
})

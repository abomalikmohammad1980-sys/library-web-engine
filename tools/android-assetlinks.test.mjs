import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,mkdir,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {validateAndroidAssetlinks,prepareAndroidAssetlinks,verifyAndroidArtifact,verifyAndroidDomain,assetlinksHeaders} from './android-assetlinks.mjs'
const fingerprint=Array(32).fill('AB').join(':')
const statement=(fingerprints=[fingerprint])=>[{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:'com.khzanah',sha256_cert_fingerprints:fingerprints}}]
test('rejects incorrect identity, missing certificate and placeholders',()=>{
 for(const value of [[],{},statement([]),statement(['placeholder']),statement(['AB:CD'])])assert.throws(()=>validateAndroidAssetlinks(value))
 const wrong=statement();wrong[0].target.package_name='com.other';assert.throws(()=>validateAndroidAssetlinks(wrong))
 assert.equal(validateAndroidAssetlinks(statement([fingerprint.toLowerCase()])).fingerprints[0],fingerprint)
})
test('both deployment outputs copy the validated source and carry static routing and headers',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'khizana-android-'))
 try{
  const source=join(dir,'source.json');await writeFile(source,JSON.stringify(statement()))
  for(const root of ['alpha-publish','deployment/cloudflare']){
   const output=join(dir,root);await mkdir(output,{recursive:true})
   const routes=await readFile(resolve(import.meta.dirname,'..',root,'scripts/pages-static/_routes.json'),'utf8')
   const templateHeaders=await readFile(resolve(import.meta.dirname,'..',root,'scripts/pages-static/_headers'),'utf8')
   assert.ok(templateHeaders.includes(assetlinksHeaders.trim()))
   const builder=await readFile(resolve(import.meta.dirname,'..',root,'scripts/prepare-cloudflare-pages.mjs'),'utf8')
   assert.ok(builder.includes('await prepareAndroidAssetlinks(output)'))
   await writeFile(join(output,'_routes.json'),routes);await writeFile(join(output,'_headers'),assetlinksHeaders)
   await prepareAndroidAssetlinks(output,{source,required:true})
   assert.deepEqual(await verifyAndroidArtifact(output),{configured:true,fingerprints:[fingerprint]})
   await writeFile(source,JSON.stringify(statement([])))
   await prepareAndroidAssetlinks(output,{source,required:false})
   await assert.rejects(readFile(join(output,'.well-known/assetlinks.json')))
   await assert.rejects(prepareAndroidAssetlinks(output,{source,required:true}),/signing_certificate_required/)
   await writeFile(source,JSON.stringify(statement()))
  }
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('live verification uses GET without redirects and checks the body and deployed certificate',async()=>{
 const run=(response,expected)=>verifyAndroidDomain('https://khzanah.com',{expected,fetchImpl:async(url,options)=>{assert.equal(url.pathname,'/.well-known/assetlinks.json');assert.equal(options.redirect,'manual');assert.equal(options.method,undefined);return response}})
 for(const response of [new Response(null,{status:301}),new Response('html',{headers:{'content-type':'text/html'}}),new Response('html',{headers:{'content-type':'application/json'}}),Response.json(statement([])),Response.json(statement([Array(32).fill('CD').join(':')]))])await assert.rejects(run(response,{fingerprints:[fingerprint]}))
 assert.equal((await run(Response.json(statement()),{fingerprints:[fingerprint]})).status,200)
})

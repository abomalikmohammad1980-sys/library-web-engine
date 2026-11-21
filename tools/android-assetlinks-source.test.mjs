import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,cp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {readAndroidAssetlinks,setAndroidFingerprints,prepareAndroidAssetlinks,verifyAndroidArtifact,assetlinksHeaders} from './android-assetlinks.mjs'
const fp=Array(32).fill('AB').join(':'),second=Array(32).fill('CD').join(':'),empty=[{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:'com.khzanah',sha256_cert_fingerprints:[]}}]
test('rejects invalid input without writing and adds both certificates idempotently',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'android-source-'));try{
  const source=join(dir,'source.json'),before=JSON.stringify(empty);await writeFile(source,before)
  await assert.rejects(setAndroidFingerprints(['AB:CD'],{source}),/fingerprint_invalid/);assert.equal(await readFile(source,'utf8'),before)
  await setAndroidFingerprints([fp.toLowerCase(),second],{source});await setAndroidFingerprints([fp],{source})
  assert.deepEqual((await readAndroidAssetlinks({source}))[0].target.sha256_cert_fingerprints,[fp,second])
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('relocated checkout finds its own source, CLI refuses bad input and mandatory preparation verifies both certificates',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'relocated-android-'));try{
  for(const p of ['tools','ops/android','output'])await mkdir(join(dir,p),{recursive:true})
  for(const name of ['android-assetlinks.mjs','verify-android-links.mjs'])await cp(join(import.meta.dirname,name),join(dir,'tools',name))
  const source=join(dir,'ops/android/assetlinks.json');await writeFile(source,JSON.stringify(empty))
  const env={...process.env};delete env.KHIZANA_ANDROID_ASSETLINKS_FILE;delete env.KHIZANA_ANDROID_ASSETLINKS_JSON
  const command=args=>spawnSync(process.execPath,args,{cwd:dir,env,encoding:'utf8'})
  const bad=command(['tools/android-assetlinks.mjs','--set-fingerprint','bad']);assert.equal(bad.status,1);assert.match(bad.stderr,/fingerprint_invalid/);assert.deepEqual(JSON.parse(await readFile(source)),empty)
  const good=command(['tools/android-assetlinks.mjs','--set-fingerprint',fp,'--set-fingerprint',second]);assert.equal(good.status,0,good.stderr)
  await writeFile(join(dir,'output/_routes.json'),JSON.stringify({exclude:['/.well-known/*']}));await writeFile(join(dir,'output/_headers'),assetlinksHeaders)
  env.KHIZANA_ANDROID_RELEASE='1'
  const prepare=command(['--input-type=module','-e',"import {prepareAndroidAssetlinks} from './tools/android-assetlinks.mjs';await prepareAndroidAssetlinks('output')"]);assert.equal(prepare.status,0,prepare.stderr)
  const verify=command(['tools/verify-android-links.mjs','--artifact','output']);assert.equal(verify.status,0,verify.stderr)
  assert.deepEqual((await verifyAndroidArtifact(join(dir,'output'))).fingerprints,[fp,second])
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('CI accepts JSON input, rejects malformed data and local file overrides, and missing sources never disappear silently',async()=>{
 const value=structuredClone(empty);value[0].target.sha256_cert_fingerprints=[fp,second]
 assert.deepEqual(await readAndroidAssetlinks({env:{CI:'true',KHIZANA_ANDROID_ASSETLINKS_JSON:JSON.stringify(value)}}),value)
 await assert.rejects(readAndroidAssetlinks({env:{CI:'true',KHIZANA_ANDROID_ASSETLINKS_FILE:'external.json'}}),/override_forbidden/)
 await assert.rejects(readAndroidAssetlinks({env:{KHIZANA_ANDROID_ASSETLINKS_JSON:'bad'}}))
 await assert.rejects(prepareAndroidAssetlinks('unused',{source:join(tmpdir(),'absent-'+Date.now()+'.json'),required:false}),{code:'ENOENT'})
})
test('fingerprint updates select the validated relation even with another statement for the same package',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'android-relations-'));try{
  const source=join(dir,'source.json'),unrelated={target:{namespace:'android_app',package_name:'com.khzanah'}}
  await writeFile(source,JSON.stringify([unrelated,...empty]));await setAndroidFingerprints([fp],{source})
  const value=JSON.parse(await readFile(source));assert.deepEqual(value[0],unrelated);assert.deepEqual(value[1].target.sha256_cert_fingerprints,[fp])
 }finally{await rm(dir,{recursive:true,force:true})}
})

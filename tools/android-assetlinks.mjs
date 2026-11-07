import {readFile,mkdir,writeFile,rm,rename} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

export const androidAssetlinksSource=resolve(import.meta.dirname,'../ops/android/assetlinks.json')
export async function readAndroidAssetlinks({source,env=process.env}={}){
  if(source)return JSON.parse(await readFile(source,'utf8'))
  if(env.KHIZANA_ANDROID_ASSETLINKS_FILE&&(env.CI||env.GITHUB_ACTIONS||env.KHIZANA_ANDROID_RELEASE==='1'))throw Error('android_assetlinks_local_override_forbidden_in_release')
  if(env.KHIZANA_ANDROID_ASSETLINKS_JSON?.trim())return JSON.parse(env.KHIZANA_ANDROID_ASSETLINKS_JSON)
  return JSON.parse(await readFile(env.KHIZANA_ANDROID_ASSETLINKS_FILE??androidAssetlinksSource,'utf8'))
}
export async function setAndroidFingerprints(fingerprints,{source=androidAssetlinksSource}={}){
  if(!fingerprints.length||fingerprints.some(value=>!/^([0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/u.test(value)))throw Error('android_assetlinks_fingerprint_invalid: expected 32 colon-separated hexadecimal bytes')
  const value=await readAndroidAssetlinks({source})
  validateAndroidAssetlinks(value,{allowUnconfigured:true})
  const target=value.find(item=>item?.target?.namespace==='android_app'&&item.target.package_name==='com.khzanah'&&Array.isArray(item.relation)&&item.relation.includes('delegate_permission/common.handle_all_urls')).target
  target.sha256_cert_fingerprints=[...new Set([...target.sha256_cert_fingerprints,...fingerprints].map(value=>value.toUpperCase()))]
  validateAndroidAssetlinks(value)
  const temporary=source+'.'+process.pid+'.tmp'
  try{await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{flag:'wx'});await rename(temporary,source)}finally{await rm(temporary,{force:true})}
  return validateAndroidAssetlinks(value)
}
export const assetlinksHeaders=`\n/.well-known/assetlinks.json\n  Content-Type: application/json; charset=utf-8\n  ! Cache-Control\n  Cache-Control: public, max-age=300\n`
export function validateAndroidAssetlinks(value,{allowUnconfigured=false}={}){
  if(!Array.isArray(value)||!value.length)throw Error('android_assetlinks_statements_missing')
  const entry=value.find(item=>item?.target?.namespace==='android_app'&&item.target.package_name==='com.khzanah'&&Array.isArray(item.relation)&&item.relation.includes('delegate_permission/common.handle_all_urls'))
  if(!entry)throw Error('android_assetlinks_package_or_relation_invalid')
  const fingerprints=entry.target.sha256_cert_fingerprints
  if(!Array.isArray(fingerprints))throw Error('android_assetlinks_fingerprints_invalid')
  if(!fingerprints.length){if(allowUnconfigured)return{configured:false,fingerprints:[]};throw Error('android_assetlinks_signing_certificate_required')}
  if(fingerprints.some(value=>typeof value!=='string'||!/^([0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/u.test(value)))throw Error('android_assetlinks_fingerprint_invalid')
  return{configured:true,fingerprints:fingerprints.map(value=>value.toUpperCase())}
}
export async function prepareAndroidAssetlinks(output,{source,required=process.env.KHIZANA_ANDROID_RELEASE==='1'}={}){
  const value=await readAndroidAssetlinks({source})
  const state=validateAndroidAssetlinks(value,{allowUnconfigured:!required})
  const destination=resolve(output,'.well-known/assetlinks.json')
  if(!state.configured){await rm(destination,{force:true});console.warn('Android domain linking is not configured: provide the Play app signing SHA-256 certificate before an Android release.');return state}
  const routes=JSON.parse(await readFile(resolve(output,'_routes.json'),'utf8'))
  if(!routes.exclude?.includes('/.well-known/*'))throw Error('android_assetlinks_static_route_required')
  await mkdir(resolve(output,'.well-known'),{recursive:true})
  await writeFile(destination,JSON.stringify(value,null,2)+'\n')
  return state
}
export async function verifyAndroidArtifact(output){
  const routes=JSON.parse(await readFile(resolve(output,'_routes.json'),'utf8'))
  if(!routes.exclude?.includes('/.well-known/*'))throw Error('android_assetlinks_static_route_required')
  const headers=await readFile(resolve(output,'_headers'),'utf8')
  if(!/\/\.well-known\/assetlinks\.json\s+Content-Type: application\/json/u.test(headers))throw Error('android_assetlinks_content_type_rule_required')
  return validateAndroidAssetlinks(JSON.parse(await readFile(resolve(output,'.well-known/assetlinks.json'),'utf8')))
}
export async function verifyAndroidDomain(origin,{expected,fetchImpl=fetch}={}){
  const url=new URL('/.well-known/assetlinks.json',origin)
  if(url.protocol!=='https:')throw Error('android_assetlinks_https_required')
  const response=await fetchImpl(url,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20_000)})
  if(response.status!==200)throw Error(`android_assetlinks_http_${response.status}`)
  if(!/^application\/json(?:\s*;|$)/iu.test(response.headers.get('content-type')??''))throw Error('android_assetlinks_content_type_invalid')
  const actual=validateAndroidAssetlinks(await response.json())
  if(expected?.fingerprints.some(value=>!actual.fingerprints.includes(value.toUpperCase())))throw Error('android_assetlinks_deployed_certificate_mismatch')
  return{url:url.href,status:response.status,contentType:response.headers.get('content-type'),...actual}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const args=process.argv.slice(2),fingerprints=[]
    for(let i=0;i<args.length;i++){if(args[i]!=='--set-fingerprint'||!args[i+1])throw Error('usage: node tools/android-assetlinks.mjs --set-fingerprint SHA256 [--set-fingerprint SHA256]');fingerprints.push(args[++i])}
    console.log(JSON.stringify(await setAndroidFingerprints(fingerprints),null,2))
  }catch(error){console.error(error.message);process.exitCode=1}
}

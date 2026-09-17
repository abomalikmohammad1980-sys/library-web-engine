import {readFile,mkdir,lstat,realpath,copyFile,readdir} from 'node:fs/promises'
import {resolve,relative} from 'node:path'
import {createHash} from 'node:crypto'
const pin='f3554cdbfca97dd9605a85b1c991b4e630a6be450fc0b49616ef05efe85b8127',sha=b=>createHash('sha256').update(b).digest('hex')
async function safe(root,path){const target=resolve(root,path),realRoot=await realpath(root),actual=await realpath(target),rel=relative(realRoot,actual);if(rel.startsWith('..')||rel.includes(':')||(await lstat(target)).isSymbolicLink())throw Error('biography_stage_path');return target}
/** Select declared immutable files only; never recursively copy old generations or delete them. */
export async function stageShamelaBiographies(sourceRoot,destinationRoot){
 const sourceData=await safe(sourceRoot,'data'),manifest=await safe(sourceData,'shamela-biographies.manifest.json'),bytes=await readFile(manifest)
 if(sha(bytes)!==pin)throw Error('biography_stage_manifest_integrity')
 const assets=JSON.parse(bytes).assets,verified=[]
 for(const asset of assets){if(asset.path!==`shamela-biographies/${asset.sha256}.json`)throw Error('biography_stage_path');const source=await safe(sourceData,asset.path),body=await readFile(source);if(body.length!==asset.bytes||sha(body)!==asset.sha256)throw Error('biography_stage_asset_integrity');verified.push([source,asset.path])}
 const output=resolve(destinationRoot,'data');await mkdir(output,{recursive:true});await safe(destinationRoot,'data');const directory=resolve(output,'shamela-biographies');await mkdir(directory,{recursive:true});await safe(output,'shamela-biographies')
 const allowed=new Set(assets.map(a=>a.path.split('/')[1]));for(const name of await readdir(directory))if(!allowed.has(name))throw Error('biography_stage_old_generation_requires_fresh_output')
 for(const [source,path] of verified){const target=resolve(output,path);try{if((await lstat(target)).isSymbolicLink())throw Error('biography_stage_path')}catch(error){if(error.code!=='ENOENT')throw error}await copyFile(source,target)}
 const target=resolve(output,'shamela-biographies.manifest.json');try{if((await lstat(target)).isSymbolicLink())throw Error('biography_stage_path')}catch(error){if(error.code!=='ENOENT')throw error}await copyFile(manifest,target)
 return{files:['shamela-biographies.manifest.json','shamela-biographies'],assets:verified.length,sha256:pin}
}

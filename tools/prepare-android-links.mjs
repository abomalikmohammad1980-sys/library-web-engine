import {mkdir,cp} from 'node:fs/promises'
import {resolve} from 'node:path'
import {prepareAndroidAssetlinks,verifyAndroidArtifact} from './android-assetlinks.mjs'
// An isolated linking artifact for CI; the website builders invoke the same helper.
const output=resolve(process.argv[2]??'android-linking-artifact')
await mkdir(output,{recursive:true})
for(const name of ['_headers','_routes.json'])await cp(resolve(import.meta.dirname,'../deployment/cloudflare/scripts/pages-static',name),resolve(output,name))
await prepareAndroidAssetlinks(output,{required:true})
console.log(JSON.stringify(await verifyAndroidArtifact(output)))

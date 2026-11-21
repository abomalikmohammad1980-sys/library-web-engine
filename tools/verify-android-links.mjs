import {readAndroidAssetlinks,validateAndroidAssetlinks,verifyAndroidArtifact,verifyAndroidDomain} from './android-assetlinks.mjs'
const args=process.argv.slice(2)
function option(name){const i=args.indexOf(name);if(i<0)return undefined;if(!args[i+1]||args[i+1].startsWith('--'))throw Error('missing '+name);return args[i+1]}
try{
  const artifact=option('--artifact'),origin=option('--origin')
  const expected=validateAndroidAssetlinks(await readAndroidAssetlinks({source:option('--source')}))
  if(artifact){const built=await verifyAndroidArtifact(artifact);if(expected.fingerprints.some(value=>!built.fingerprints.includes(value)))throw Error('android_assetlinks_artifact_certificate_mismatch')}
  if(origin)console.log(JSON.stringify(await verifyAndroidDomain(origin,{expected}),null,2))
  else console.log(JSON.stringify({configured:true,artifactVerified:Boolean(artifact),...expected},null,2))
}catch(error){console.error(error.message);process.exitCode=1}

import {json} from '../_account-contract.js'
import {readActiveBokRelease} from '../_bok-release-pointer.js'
export async function onRequest({request,env}){
 if(request.method!=='GET')return json({error:'method_not_allowed'},405,{allow:'GET'})
 if(env.BOK_RELEASE_ACTIVATION_ENABLED!=='1')return json({release:null})
 const release=await readActiveBokRelease(env.VISITORS_DB)
 if(!release)return json({release:null})
 const hash=/^[a-f0-9]{64}$/
 if(!hash.test(release.releaseId)||!hash.test(release.readerManifestSha256)||!hash.test(release.searchManifestSha256)||release.artifactRoot!==`/library/bok-releases/${release.releaseId}`)return json({error:'invalid_bok_release'},503)
 return json({release:{contract:'bok-active-release/1',...release}})
}

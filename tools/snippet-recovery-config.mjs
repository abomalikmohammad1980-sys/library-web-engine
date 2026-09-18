import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
export async function snippetRecoveryConfig(origin){
 const sha=b=>createHash('sha256').update(b).digest('hex'),pin='81735c749b853a08f1bb2c6eb750062ee42dcdc8f3db93d7c5d2b10868907f3e',sourceManifestSha256='b1815eeec97468f791b5a155f43b4f9d85f2d783926d0162bef896397b03f54b'
 const manifest=await readFile('release-artifacts/snippet-source-recovery-aa8ba3b2ea338a83/manifest.json'),correction=await readFile('release-artifacts/search-source-corrections-4ba908f1d2f92f69/corrections.json')
 if(sha(manifest)!==pin||sha(correction)!=='4ba908f1d2f92f6937369dfb310170de8e0bc8237e0d288846774365ac554345')throw Error('recovery_integrity')
 const baseUrl=origin+'/library/snippet-recovery/'+pin+'/'
 return{releaseId:'shamela-search-v2-packed-a88f1f13ac8f8fd6-p8-l26213376-t1-r1',sourceManifestSha256,baseUrl,manifest:{sourceManifestSha256,sha256:pin,byteLength:manifest.length,auditSha256:JSON.parse(manifest).auditSha256,rows:30289},corrections:{url:baseUrl+'corrections.json',sha256:sha(correction),byteLength:correction.length}}
}

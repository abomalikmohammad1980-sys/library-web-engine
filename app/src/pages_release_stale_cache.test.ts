import {afterEach,it,expect,vi} from 'vitest'
import {loadPagesReleaseConfig,pagesReleaseConfigPath,resetPagesDataReleaseForTests} from './pages_data_release'
const release='601fbdb9ac80f05dd86d2383',config={contract:'alkhizana-pages-client/1',releaseId:release,projects:[]}
afterEach(()=>{vi.unstubAllGlobals();resetPagesDataReleaseForTests()})
function marker(value:string){vi.stubGlobal('document',{querySelector:()=>({getAttribute:()=>value})})}
it('misses the old cache-first key using the shell release marker',async()=>{
 marker(release)
 const fetcher=vi.fn(async(input:RequestInfo|URL)=>String(input)==='./data/shamela-pages-release.json'?Response.json({...config,releaseId:'b'.repeat(24)}):Response.json(config))
 expect((await loadPagesReleaseConfig(fetcher))?.releaseId).toBe(release)
 expect(fetcher).toHaveBeenCalledWith(`./data/shamela-pages-release.json?release=${release}`,{cache:'no-cache'})
})
it('rejects an old descriptor even if a stale worker ignores the query',async()=>{
 marker(release)
 await expect(loadPagesReleaseConfig(async()=>Response.json({...config,releaseId:'b'.repeat(24)}))).rejects.toThrow('pages_release_marker_mismatch')
})
it('rejects invalid release markers and preserves local compatibility without one',()=>{
 marker('../old');expect(()=>pagesReleaseConfigPath()).toThrow('pages_release_marker_invalid')
 vi.unstubAllGlobals();expect(pagesReleaseConfigPath()).toBe('./data/shamela-pages-release.json')
})

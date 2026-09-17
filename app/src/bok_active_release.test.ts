import {afterEach,it,expect,vi} from 'vitest'
const sha='a'.repeat(64),descriptor={contract:'bok-active-release/1',generation:1,releaseId:sha,readerManifestSha256:'b'.repeat(64),searchManifestSha256:'c'.repeat(64),artifactRoot:`/library/bok-releases/${sha}`}
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules()})
it('disabled adds zero network calls',async()=>{const m=await import('./bok_active_release'),fetcher=vi.fn();expect(await m.pinBokActiveRelease(fetcher)).toBe(null);expect(fetcher).not.toHaveBeenCalled()})
it('one document pin serves reader/search and cannot drift to a newer response',async()=>{
 vi.stubGlobal('__BOK_RELEASES_ENABLED__',true);vi.stubGlobal('location',{origin:'https://khzanah.com'})
 const m=await import('./bok_active_release'),fetcher=vi.fn(async()=>Response.json({release:descriptor}))
 const [a,b]=await Promise.all([m.pinBokActiveRelease(fetcher),m.pinBokActiveRelease(fetcher)])
 expect(a).toBe(b);expect(fetcher).toHaveBeenCalledTimes(1);expect(m.pinnedBokSearchManifestHash()).toBe(descriptor.searchManifestSha256)
 expect(m.pinnedBokSearchConfig()?.controlBaseUrl).toBe(`https://khzanah.com${descriptor.artifactRoot}/packed/control`)
 expect(Object.isFrozen(a)).toBe(true)
})
it('rejects arbitrary origin/path and keeps network failure fail-closed',async()=>{
 vi.stubGlobal('__BOK_RELEASES_ENABLED__',true);const m=await import('./bok_active_release')
 expect(()=>m.validateBokActiveRelease({...descriptor,artifactRoot:'https://hostile.invalid'})).toThrow(/invalid/)
 const fetcher=vi.fn(async()=>new Response('',{status:503}));await expect(m.pinBokActiveRelease(fetcher)).rejects.toThrow(/unavailable/);await expect(m.pinBokActiveRelease(fetcher)).rejects.toThrow(/unavailable/);expect(fetcher).toHaveBeenCalledTimes(1)
})
it('bounded descriptor parser refuses excessive data',async()=>{const m=await import('./bok_active_release');await expect(m.boundedReleaseJson(new Response(' '.repeat(9000)),8192)).rejects.toThrow(/too_large/)})
it('reader refuses content that differs from the pinned manifest hash',async()=>{
 vi.stubGlobal('__BOK_RELEASES_ENABLED__',true);const m=await import('./bok_active_release')
 const fetcher=vi.fn(async(url:unknown)=>String(url).includes('/api/')?Response.json({release:descriptor}):Response.json({books:[]}))
 await expect(m.activeBokReaderEntry('93',fetcher)).rejects.toThrow(/mismatch/)
 expect(m.pinnedBokSearchManifestHash()).toBe(descriptor.searchManifestSha256)
})

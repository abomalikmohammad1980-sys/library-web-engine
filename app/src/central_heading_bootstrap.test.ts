import {describe,it,expect,vi} from 'vitest'
import {readFileSync} from 'node:fs'
import {ensureCentralHeadingProvider,validateCentralHeadingRelease,createHeadingBootstrapTask} from './central_heading_bootstrap'
import {shamelaPublicBookId} from './shamela_public_identity'
import headingReleaseText from './heading_release.generated.json?raw'
describe('pinned lazy heading bootstrap',()=>{
 it('bounds a shared stalled request and retries after timeout',async()=>{
  let calls=0;let firstSignal:AbortSignal|undefined
  const run=createHeadingBootstrapTask(signal=>{if(++calls===1){firstSignal=signal;return new Promise<string>(()=>{})}return Promise.resolve('ready')},5)
  const first=run(),second=run();expect(first).toBe(second)
  await expect(first).rejects.toThrow('heading_release_timeout');expect(firstSignal?.aborted).toBe(true)
  expect(await run()).toBe('ready');expect(calls).toBe(2)
 })
 it('validates the bundled release without a service-worker-controlled descriptor request',async()=>{const spy=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('must_not_fetch_descriptor'));try{const release=await validateCentralHeadingRelease(new TextEncoder().encode(headingReleaseText.trimEnd()));expect(release.coveredSourceBookIds).toHaveLength(8553);expect(release.baseURL).toBe(`/api/search/headings/${release.releaseId}/`);expect(spy).not.toHaveBeenCalled()}finally{spy.mockRestore()}})
 it('verifies actual release SHA,8553 source IDs and mapping',async()=>{
  const bytes=readFileSync(new URL('../../artifacts/heading-search-central-v2/client-release.json',import.meta.url))
  const release=await validateCentralHeadingRelease(bytes)
  expect(release.coveredSourceBookIds).toHaveLength(8553);expect(shamelaPublicBookId(release.coveredSourceBookIds[0]!)).toBe('410000001')
  const corrupt=Uint8Array.from(bytes);corrupt[0]=0;await expect(validateCentralHeadingRelease(corrupt)).rejects.toThrow('heading_release_integrity')
 })
})

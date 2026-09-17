import {afterEach,describe,expect,it,vi} from 'vitest'
import {connectWord,forgetConnectedWord,hasConnectedWordSession,convertWithConnectedWord} from './word_connected_client'
afterEach(()=>{forgetConnectedWord();vi.unstubAllGlobals()})
describe('local Word connection',()=>{
 it('reports measured package bytes only, with explicit local-processing stages',async()=>{
  vi.useFakeTimers()
  try{
   const fetcher=vi.fn().mockResolvedValueOnce(Response.json({contract:'khizana-connected-word/1',ready:true})).mockResolvedValueOnce(Response.json({jobId:'a'.repeat(32)},{status:202})).mockResolvedValueOnce(new Response(new Uint8Array([1,2,3,4]),{headers:{'Content-Type':'application/vnd.khizana.word-package','Content-Length':'4'}}))
   vi.stubGlobal('fetch',fetcher);await connectWord('b'.repeat(64))
   const progress=vi.fn(),pending=convertWithConnectedWord(new File(['source'],'test.docx'),progress)
   await vi.advanceTimersByTimeAsync(1000);expect(await pending).toEqual(new Uint8Array([1,2,3,4]))
   expect(progress.mock.calls.map(c=>c[0].stage)).toEqual(['sending','processing','receiving','receiving'])
   expect(progress).toHaveBeenLastCalledWith({stage:'receiving',loaded:4,total:4})
  }finally{vi.useRealTimers()}
 })
 it('rejects incomplete pairing without sending requests',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher)
  await expect(connectWord('123')).rejects.toThrow('رمز الاتصال')
  expect(fetcher).not.toHaveBeenCalled();expect(hasConnectedWordSession()).toBe(false)
 })
 it('uses loopback with explicit token and no cookies',async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({contract:'khizana-connected-word/1',ready:true})))
  vi.stubGlobal('fetch',fetcher);await connectWord('a'.repeat(64))
  expect(hasConnectedWordSession()).toBe(true)
  expect(fetcher).toHaveBeenCalledWith('http://localhost:43129/v1/status',expect.objectContaining({credentials:'omit',redirect:'error',headers:{'X-Khizana-Token':'a'.repeat(64)}}))
 })
 it('never starts conversion without pairing',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher)
  await expect(convertWithConnectedWord(new File(['bytes'],'test.docx'))).rejects.toThrow('اربط مساعد')
  expect(fetcher).not.toHaveBeenCalled()
 })
 it('clears pairing when the service rejects it',async()=>{
  vi.stubGlobal('fetch',async()=>new Response('{}',{status:401}))
  await expect(connectWord('b'.repeat(64))).rejects.toThrow('غير صالح')
  expect(hasConnectedWordSession()).toBe(false)
 })
})

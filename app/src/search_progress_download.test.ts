import {expect,it,vi} from 'vitest'
import {searchProgressDownload} from './search_progress_download'
it('keeps a progressing body after the old absolute idle interval',async()=>{
 vi.useFakeTimers()
 try{
  let stream!:ReadableStreamDefaultController<Uint8Array>
  const fetcher=vi.fn(async()=>new Response(new ReadableStream<Uint8Array>({start(c){stream=c}}))) as unknown as typeof fetch
  const task=searchProgressDownload(fetcher,'https://example.test/index',3,{idleMs:20,totalMs:100})
  await vi.advanceTimersByTimeAsync(10);stream.enqueue(new Uint8Array([1]))
  await vi.advanceTimersByTimeAsync(15);stream.enqueue(new Uint8Array([2]))
  await vi.advanceTimersByTimeAsync(15);stream.enqueue(new Uint8Array([3]));stream.close()
  expect(await task).toEqual(new Uint8Array([1,2,3]))
 }finally{vi.useRealTimers()}
})
it('cancels stalled and perpetually progressing bodies at their distinct limits',async()=>{
 vi.useFakeTimers()
 try{for(const progressing of [false,true]){
  let stream!:ReadableStreamDefaultController<Uint8Array>,cancelled=false
  const task=searchProgressDownload(async()=>new Response(new ReadableStream<Uint8Array>({start(c){stream=c},cancel(){cancelled=true}})),'https://example.test/index',100,{idleMs:20,totalMs:45})
  const rejected=expect(task).rejects.toThrow('term_network_timeout')
  if(progressing){for(let i=0;i<4;i++){await vi.advanceTimersByTimeAsync(10);stream.enqueue(new Uint8Array([1]))}}
  await vi.advanceTimersByTimeAsync(25);await rejected;expect(cancelled).toBe(true)
 }}finally{vi.useRealTimers()}
})
it('rejects short and over-budget responses',async()=>{
 await expect(searchProgressDownload(async()=>new Response('ab'),'https://example.test',3)).rejects.toThrow('integrity')
 await expect(searchProgressDownload(async()=>new Response('abcd'),'https://example.test',3)).rejects.toThrow('oversized')
})

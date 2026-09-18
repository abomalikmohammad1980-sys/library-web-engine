import {expect,it,vi} from 'vitest'
import {createReaderIdlePrewarm, readerPrewarmRouteEligible} from './reader_idle_prewarm'
it('reserves biography, author lists and search bandwidth until a book is opened',()=>{
 for(const route of ['home','people','author','authors','search','sunnah','sunnah-source','welcome','sign-in'])expect(readerPrewarmRouteEligible(route)).toBe(false)
 for(const route of ['library','browse','shelves'])expect(readerPrewarmRouteEligible(route)).toBe(true)
})
it('checks eligibility again at execution and permits a later eligible attempt',async()=>{
 let allowed=true;const queue:Array<()=>void>=[],load=vi.fn(async()=>{})
 const schedule=createReaderIdlePrewarm(()=>allowed,load,callback=>queue.push(callback))
 schedule();schedule();expect(queue).toHaveLength(1)
 allowed=false;queue.shift()!();await Promise.resolve();expect(load).not.toHaveBeenCalled()
 allowed=true;schedule();queue.shift()!();await Promise.resolve();await Promise.resolve()
 expect(load).toHaveBeenCalledTimes(1);schedule();expect(queue).toHaveLength(0)
})
it('hidden or unrelated routes do not queue work',()=>{
 const enqueue=vi.fn();createReaderIdlePrewarm(()=>false,async()=>{},enqueue)()
 expect(enqueue).not.toHaveBeenCalled()
})
it('failed import is handled and allows retry without automatic looping',async()=>{
 const queue:Array<()=>void>=[],load=vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(undefined)
 const schedule=createReaderIdlePrewarm(()=>true,load,callback=>queue.push(callback))
 schedule();queue.shift()!();await new Promise(resolve=>setTimeout(resolve,0))
 expect(queue).toHaveLength(0);schedule();expect(queue).toHaveLength(1)
 queue.shift()!();await Promise.resolve();await Promise.resolve();expect(load).toHaveBeenCalledTimes(2)
})

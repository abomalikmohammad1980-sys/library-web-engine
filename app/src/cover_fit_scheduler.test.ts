import {expect,it,vi} from 'vitest'
import {coalesceCoverFit} from './cover_fit_scheduler'

it('coalesces resize, mutation and font notifications into one measurement pass',()=>{
 const frames:Array<()=>void>=[],fit=vi.fn(),schedule=coalesceCoverFit(cb=>frames.push(cb),fit)
 schedule();schedule();schedule()
 expect(frames).toHaveLength(1);expect(fit).not.toHaveBeenCalled()
 frames.shift()!();expect(fit).toHaveBeenCalledOnce()
 schedule();expect(frames).toHaveLength(1);frames.shift()!();expect(fit).toHaveBeenCalledTimes(2)
})
it('does not lose changes triggered during fitting',()=>{
 const frames:Array<()=>void>=[];let calls=0
 const schedule=coalesceCoverFit(cb=>frames.push(cb),()=>{if(++calls===1)schedule()})
 schedule();frames.shift()!();expect(frames).toHaveLength(1);frames.shift()!();expect(calls).toBe(2)
})

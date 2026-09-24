import {expect,it} from 'vitest'
import {requestedPage} from './page_jump'
it('accepts Arabic or Western page numbers and rejects out-of-range jumps',()=>{
 expect(requestedPage('١٣',13)).toBe(12);expect(requestedPage('13',13)).toBe(12)
 for(const value of ['0','14','-1','1.5','','abc'])expect(requestedPage(value,13)).toBeNull()
})

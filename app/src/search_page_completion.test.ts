import {expect,it} from 'vitest'
import {completeSearchPage,fetchOrderedSearchWindow,searchPageReady} from './search_page_completion'
it('does not present the four cached rows as a complete second page',async()=>{
 let loaded=104,offset=100,calls=0
 expect(searchPageReady(1,100,loaded,true)).toBe(false)
 expect(await completeSearchPage(1,100,()=>({loaded,more:offset<904,current:true}),async()=>{calls++;offset+=100;loaded+=100})).toBe(true)
 expect(calls).toBe(1);expect(loaded).toBe(204)
})
it('fills page seven and allows a genuinely final partial page',async()=>{
 let loaded=604,offset=600
 await completeSearchPage(6,100,()=>({loaded,more:offset<904,current:true}),async()=>{offset+=100;loaded+=100})
 expect(loaded).toBe(704);expect(searchPageReady(9,100,904,false)).toBe(true)
})
it('does not silently accept a partial page after network failure',async()=>{
 await expect(completeSearchPage(1,100,()=>({loaded:104,more:true,current:true}),async()=>{throw Error('offline')})).rejects.toThrow('offline')
 expect(await completeSearchPage(1,100,()=>({loaded:104,more:true,current:false}),async()=>{})).toBe(false)
})
it('fetches a bounded jump window concurrently and commits in offset order',async()=>{
 const called:number[]=[],committed:number[]=[],finish=new Map<number,(value:number)=>void>()
 const pending=fetchOrderedSearchWindow([200,300,400],offset=>{called.push(offset);return new Promise<number>(resolve=>finish.set(offset,resolve))},(offset,value)=>{expect(value).toBe(offset+1);committed.push(offset)})
 expect(called).toEqual([200,300,400]);finish.get(400)!(401);finish.get(200)!(201);finish.get(300)!(301)
 await pending;expect(committed).toEqual([200,300,400])
})
it('keeps the contiguous successful prefix when a jump batch fails',async()=>{
 const committed:number[]=[]
 await expect(fetchOrderedSearchWindow([200,300,400],offset=>offset===300?Promise.reject(Error('offline')):Promise.resolve(offset),offset=>committed.push(offset))).rejects.toThrow('offline')
 expect(committed).toEqual([200])
})

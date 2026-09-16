import {expect,it} from 'vitest'
import {combineHeadingProviders} from './heading_catalog_supplement'
import type {CentralHeadingProvider} from './central_heading_integration'

const result={hits:[],total:0,totalExact:true,coverageComplete:true,indexedBooks:1}
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r});return{promise,resolve}}
const provider=(id:string,search:CentralHeadingProvider['client']['search']):CentralHeadingProvider=>({releaseId:id,coveredBookIds:new Set([id]),client:{search}})

it('drains a failed sibling before admitting a retry, without hiding the first error',async()=>{
 const entered=deferred(),cancelled=deferred(),drained=deferred()
 let first=true,busy=false
 const main=provider('1',async()=>{if(first){await entered.promise;throw Error('network unavailable')}return result})
 const supplement=provider('2',async(_q,o)=>{
  if(busy)throw Error('heading_search_busy')
  if(!first)return result
  busy=true;entered.resolve()
  await new Promise<void>(resolve=>o?.signal?.addEventListener('abort',()=>{cancelled.resolve();void drained.promise.then(resolve)},{once:true}))
  busy=false;first=false;throw o?.signal?.reason
 })
 const combined=combineHeadingProviders(main,supplement)
 const failed=expect(combined.client.search('old')).rejects.toThrow('network unavailable')
 await cancelled.promise
 const retry=combined.client.search('new')
 drained.resolve()
 await failed;expect(await retry).toMatchObject({total:0,coverageComplete:true})
})

it('serializes consumers and skips a cancelled queued query',async()=>{
 const entered=deferred(),finish=deferred();let active=0,max=0;const calls:string[]=[]
 const main=provider('1',async q=>{active++;max=Math.max(max,active);calls.push(q);if(q==='first'){entered.resolve();await finish.promise}active--;return result})
 const combined=combineHeadingProviders(main,provider('2',async()=>result))
 const first=combined.client.search('first');await entered.promise
 const controller=new AbortController()
 const skipped=expect(combined.client.search('cancelled',{signal:controller.signal})).rejects.toThrow()
 const next=combined.client.search('last');controller.abort();finish.resolve()
 await first;await skipped;await next
 expect(calls).toEqual(['first','last']);expect(max).toBe(1)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {afterPublicBookMutation} from '../deployment/cloudflare/functions/api/_public-book-index-wake.js'
test('successful committed mutation schedules trusted service wake without blocking response',async()=>{
 let calls=0;const pending=[],response=new Response('saved',{status:201})
 const context={request:new Request('https://khzanah.com/api/account/books',{method:'POST'}),env:{BOOK_INDEX_QUEUE_ENABLED:'true',BOOK_INDEX_WAKE:{fetch:async(url,init)=>{calls++;assert.equal(url,'https://book-index.internal/wake');assert.deepEqual(init,{method:'POST'});return new Response(null)}}},waitUntil(promise){assert.equal(this,context);pending.push(promise)}}
 assert.equal(afterPublicBookMutation(context,response),response);assert.equal(calls,0);await Promise.all(pending);assert.equal(calls,1)
 context.env.BOOK_INDEX_WAKE.fetch=async()=>{throw Error('secret network diagnostic')}
 assert.equal(afterPublicBookMutation(context,response),response);await Promise.all(pending)
})
test('disabled, unauthorized/error response, GET and missing waitUntil never wake',async()=>{
 let calls=0;const base={request:new Request('https://khzanah.com/api/books',{method:'PATCH'}),env:{BOOK_INDEX_QUEUE_ENABLED:'true',BOOK_INDEX_WAKE:{fetch:async()=>{calls++;return new Response(null)}}},waitUntil(){}}
 for(const code of [400,401,403,409,500])afterPublicBookMutation(base,new Response(null,{status:code}))
 afterPublicBookMutation({...base,request:new Request('https://khzanah.com')},new Response(null))
 afterPublicBookMutation({...base,env:{...base.env,BOOK_INDEX_QUEUE_ENABLED:'false'}},new Response(null))
 afterPublicBookMutation({...base,waitUntil:undefined},new Response(null))
 await Promise.resolve();assert.equal(calls,0)
})

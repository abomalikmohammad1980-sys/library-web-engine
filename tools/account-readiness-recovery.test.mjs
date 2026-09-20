import test from 'node:test'
import assert from 'node:assert/strict'
import {onRequestGet,readinessFailure} from '../deployment/cloudflare/functions/api/account/readiness.js'
const envFor=(fail)=>({LIBRARY_R2:{},VISITORS_DB:{queries:[],prepare(sql){this.queries.push(sql);return{first:async()=>{if(fail&&sql.includes('FROM accounts LIMIT'))throw Error(fail);return null}}}}})
test('bounds the only account-data read and validates columns without reading records',async()=>{
 const env=envFor();const response=await onRequestGet({env});assert.equal(response.status,200);assert.equal((await response.json()).native.configured,true)
 assert(env.VISITORS_DB.queries[0].endsWith('WHERE 0'));assert.equal(env.VISITORS_DB.queries[1],'SELECT 1 AS available FROM accounts LIMIT 1')
})
test('quota is temporary, never ready, and repeated probes back off',async()=>{
 const env=envFor("D1_ERROR: Your account has exceeded D1's free tier daily row read limit")
 const response=await onRequestGet({env}),body=await response.json();assert.equal(response.status,503);assert.equal(body.reason,'database_quota_exhausted');assert.equal(body.ready,false);assert.equal(response.headers.get('retry-after'),'30')
 await onRequestGet({env});assert.equal(env.VISITORS_DB.queries.length,2)
})
test('missing bindings/schema do not silently enable authentication',async()=>{
 assert.equal((await (await onRequestGet({env:{}})).json()).reason,'bindings_missing')
 assert.equal(readinessFailure(Error('no such table: account_credentials')),'schema_missing')
 assert.equal(readinessFailure(Error('network unavailable')),'temporarily_unavailable')
})

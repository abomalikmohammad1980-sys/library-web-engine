import {test} from 'node:test'
import assert from 'node:assert/strict'
import {configuredConcurrency,memoryCapacity} from '../local-agent/capacity.mjs'
import {llamaBase} from '../local-agent/client.mjs'
test('only measured concurrency settings are accepted',()=>{
 for(const n of [1,2,4])assert.equal(configuredConcurrency(String(n)),n)
 for(const n of [0,3,6,7,8,'x'])assert.throws(()=>configuredConcurrency(n))
})
test('memory guard reduces new work and recovers without changing cloud state',()=>{
 const cap=mb=>memoryCapacity(4,mb*1024*1024)
 assert.equal(cap(2000),4);assert.equal(cap(1600),2);assert.equal(cap(1300),1);assert.equal(cap(1000),0);assert.equal(cap(2000),4)
 assert.equal(memoryCapacity(1,3000*1024*1024),1)
})
test('model port is configurable but strictly loopback',()=>{
 assert.equal(llamaBase('8080'),'http://127.0.0.1:8080');assert.equal(llamaBase('8081'),'http://127.0.0.1:8081')
 for(const value of ['https://example.com','8081/path','8081@host','0','9000'])assert.throws(()=>llamaBase(value))
})

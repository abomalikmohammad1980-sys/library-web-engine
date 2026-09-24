import assert from 'node:assert/strict'
import test from 'node:test'
import {publicClaims} from '../functions/api/_account-contract.js'
test('nullable and malformed optional display names do not invalidate verified identity',()=>{
 for(const displayName of [null,undefined,{},42,'x'.repeat(201)]){
  const input={subject:'verified-account',role:'user',displayName}
  const output=JSON.parse(JSON.stringify(publicClaims(input)))
  assert.deepEqual(output,{subject:'verified-account',role:'user',sessionId:'access:verified-account'})
  assert.equal(input.displayName,displayName)
 }
})
test('valid names and role remain unchanged; private account fields never become claims',()=>{
 const output=publicClaims({subject:'verified-account',role:'editor',displayName:'قارئ',email:'private@example.test',password_hash:'private'})
 assert.deepEqual(output,{subject:'verified-account',role:'editor',displayName:'قارئ',sessionId:'access:verified-account'})
})

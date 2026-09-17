import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {ingestionFailureCode,ingestionGateway} from './public-book-index-runner.mjs'
test('final diagnosis uses exact runtime and gateway allowlists only',()=>{
 for(const code of ['ingestion_not_accepted','ingestion_credentials_missing','invalid_index_target','gateway_claim_404_not_found','gateway_claim_422_ingestion_claim_failed','gateway_claim_transport_failed','gateway_claim_transport_timeout','gateway_claim_invalid_response'])assert.equal(ingestionFailureCode(Error(code)),code)
 for(const message of ['Bearer secretvalue','https://secret.example/?token=abcdef','gateway_claim_422_secretvalue','gateway_claim_999_not_found','gateway_secret_401_not_found','ingestion_not_accepted\nTOKEN=secret','secret_value_without_spaces'])assert.equal(ingestionFailureCode(Error(message)),'unclassified_failure')
 assert.equal(ingestionFailureCode({get message(){throw Error('secret')}}),'unclassified_failure')
})
test('transport and malformed responses are mapped without body/header/exception leakage',async()=>{
 const secret='DO_NOT_LOG_SECRET_TOKEN',config={token:'a'.repeat(48)}
 for(const [fetcher,expected] of [[async()=>{throw Error(secret)},'gateway_claim_transport_failed'],[async()=>{throw Object.assign(Error(secret),{name:'TimeoutError'})},'gateway_claim_transport_timeout'],[async()=>new Response(secret,{status:200}),'gateway_claim_invalid_response'],[async()=>Response.json({error:secret},{status:403}),'gateway_claim_403_unknown']]){
  try{await ingestionGateway(config,fetcher)({op:'claim'});assert.fail('expected failure')}catch(error){const code=ingestionFailureCode(error);assert.equal(code,expected);assert(!code.includes(secret))}
 }
})
test('real CLI reports safe missing-acceptance diagnosis without printing environment secrets',()=>{
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('./public-book-index-runner.mjs',import.meta.url))],{env:{PUBLIC_BOOK_INDEX_RUNNER_TOKEN:'SUPER_SECRET_MARKER'},encoding:'utf8',windowsHide:true})
 assert.equal(result.status,1);assert.match(result.stderr,/"code":"ingestion_not_accepted"/);assert.doesNotMatch(result.stderr+result.stdout,/SUPER_SECRET_MARKER/)
})

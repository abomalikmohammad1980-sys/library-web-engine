import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {prepareVerifiedBokRegistration} from './register-bok-verified-release.mjs'
test('isolated cloud two-book evidence cannot authorize production registration',async()=>{
 await mkdir('.artifacts/bok-registration-tests',{recursive:true});const root=await mkdtemp(resolve('.artifacts/bok-registration-tests/case-'))
 await writeFile(root+'/transaction.json',JSON.stringify({contract:'bok-publication-transaction/1',packedArtifactsVerified:true,bookId:'93',files:[{}]}))
 await writeFile(root+'/candidate.json',JSON.stringify({contract:'bok-text-release/1',bookId:'410000093',sourceHash:'a'.repeat(64)}))
 await writeFile(root+'/receipt.json',JSON.stringify({passed:true,fixtureBooks:2,fullLibrary:false}))
 await assert.rejects(prepareVerifiedBokRegistration({transactionRoot:root,candidatePath:root+'/candidate.json',cloudReceiptPath:root+'/receipt.json',output:root+'/must-not-exist.sql'}),/bok_registration_cloud_gate/)
})

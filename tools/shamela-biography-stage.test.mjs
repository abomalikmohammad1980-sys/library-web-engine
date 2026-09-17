import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readdir,readFile,writeFile,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {stageShamelaBiographies} from '../alpha-publish/scripts/shamela-biography-stage.mjs'
test('staging mirrors pin the approved runtime manifest and actual author metadata',async()=>{
 const read=path=>readFile(new URL('../'+path,import.meta.url))
 const manifest=await read('app/public/data/shamela-biographies.manifest.json'),digest=b=>createHash('sha256').update(b).digest('hex'),hash=digest(manifest)
 const runtime=(await read('app/src/shamela_biography.ts')).toString()
 assert.ok(runtime.includes("SHAMELA_BIOGRAPHY_MANIFEST_SHA='"+hash+"'"))
 for(const path of ['alpha-publish/scripts/shamela-biography-stage.mjs','deployment/cloudflare/scripts/shamela-biography-stage.mjs'])assert.ok((await read(path)).toString().includes("const pin='"+hash+"'"))
 assert.equal(JSON.parse(manifest).metadataSha256,digest(await read('app/public/data/shamela-author-metadata.json')))
})
test('copies exactly declared verified assets and refuses stale output without deleting it',async()=>{
 const out=await mkdtemp(join(tmpdir(),'shamela-bio-stage-')),source=fileURLToPath(new URL('../app/public/',import.meta.url)),result=await stageShamelaBiographies(source,out)
 assert.equal(result.assets,2716);assert.equal((await readdir(join(out,'data/shamela-biographies'))).length,2716)
 const extra=join(out,'data/shamela-biographies/old-generation.json');await writeFile(extra,'preserve')
 await assert.rejects(stageShamelaBiographies(source,out),/old_generation/);assert.equal(await readFile(extra,'utf8'),'preserve')
})
test('rejects a changed declaration before copying assets',async()=>{
 const source=await mkdtemp(join(tmpdir(),'shamela-bio-source-')),out=await mkdtemp(join(tmpdir(),'shamela-bio-output-'));await mkdir(join(source,'data'));await writeFile(join(source,'data/shamela-biographies.manifest.json'),'{}')
 await assert.rejects(stageShamelaBiographies(source,out),/manifest_integrity/);assert.deepEqual(await readdir(out),[])
})

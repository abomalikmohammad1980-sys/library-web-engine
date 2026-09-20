import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {inlineThemeBootstrap} from './inline-theme-bootstrap.mjs'
const html='<html><head><script src="/theme-init.js"></script></head></html>'
const headers="Content-Security-Policy: script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline';"
test('prepaint theme keeps exact normalized bytes and a matching narrow CSP hash',async()=>{
 const source=await readFile(new URL('../app/public/theme-init.js',import.meta.url),'utf8')
 const result=inlineThemeBootstrap(html,headers,source)
 const script=result.index.match(/<script data-theme-bootstrap>([\s\S]*)<\/script>/)[1]
 assert.equal(script,source.replace(/\r\n?/g,'\n'))
 assert.equal(result.hash,"'sha256-"+createHash('sha256').update(script).digest('base64')+"'")
 assert.ok(result.headers.includes(result.hash));assert.ok(!result.index.includes('src='))
 assert.match(result.headers,/script-src 'self' 'wasm-unsafe-eval' 'sha256-/)
})
test('malformed markup, unsafe policy and injected closing tags fail closed',()=>{
 for(const [h,c,s] of [[html+html,headers,'ok'],[html,headers,"</script>"],[html,"script-src 'unsafe-inline';",'ok'],[html,'','ok']])assert.throws(()=>inlineThemeBootstrap(h,c,s))
})

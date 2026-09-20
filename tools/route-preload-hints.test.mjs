import {test} from 'node:test'
import assert from 'node:assert/strict'
import {routePreloadHints,inlineRoutePreloads} from './route-preload-hints.mjs'
test('collects static screen dependencies only and handles cycles',()=>{
 const bundle={a:{type:'chunk',name:'home',isDynamicEntry:true,fileName:'a',imports:['b','main'],dynamicImports:['pdf']},b:{type:'chunk',imports:['a']},main:{type:'chunk',isEntry:true,imports:[]},pdf:{type:'chunk',imports:[]},styles:{type:'chunk',name:'route_full_styles',viteMetadata:{importedCss:new Set(['assets/full.css'])}}}
 let result;routePreloadHints().generateBundle.call({emitFile:x=>result=JSON.parse(x.source)},null,bundle)
 assert.deepEqual(result.home,['/a','/b'])
 assert.deepEqual(result.styles,['/assets/full.css'])
})
test('validates only same-origin hashed script hints and authorizes exact bytes',()=>{
 const value=inlineRoutePreloads('<head><script type="module" src="/assets/main.js"></script><link rel="stylesheet" href="/assets/main.css"></head>',"script-src 'self';",{home:['/assets/home-x.js']})
 assert.match(value.index,/data-route-preloads/);assert.match(value.headers,/sha256-/);assert.doesNotMatch(value.headers,/unsafe-inline/)
 assert(value.index.indexOf('data-route-preloads')<value.index.indexOf('rel="stylesheet"'))
 assert.throws(()=>inlineRoutePreloads('<head></head>',"script-src 'self';",{home:['https://other/x.js']}))
})

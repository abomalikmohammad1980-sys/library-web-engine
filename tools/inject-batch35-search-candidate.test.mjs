import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {injectBatch35SearchCandidate,CANDIDATE_SCRIPT_PATH} from './inject-batch35-search-candidate.mjs'
const configSource=readFileSync(new URL('./batch35-search-candidate-config.js',import.meta.url),'utf8')
const base={configSource,candidate:'batch35',serverAcceptance:{PUBLIC_BOOK_SEARCH_ENABLED:'true',HEADING_QUERY_ENABLED:'0'}}
const html='<html><head><script src="/theme-init.js"></script><script src="/data/shamela-search-v2-packed.js"></script><script type="module" crossorigin src="/assets/index-ab.js"></script></head><body></body></html>'
test('single absolute blocking config follows baseline scripts and precedes compiledmodule',()=>{
 const result=injectBatch35SearchCandidate({...base,html})
 assert.ok(result.html.indexOf(CANDIDATE_SCRIPT_PATH)>result.html.indexOf('shamela-search-v2-packed.js'))
 assert.ok(result.html.indexOf(CANDIDATE_SCRIPT_PATH)<result.html.indexOf('type="module"'))
 assert.equal(result.html.match(/src="\/data\/batch35-search-candidate-config.js"/g).length,1)
 const again=injectBatch35SearchCandidate({...base,html:result.html});assert.equal(again.html.match(/src="\/data\/batch35-search-candidate-config.js"/g).length,1)
 assert.equal(result.productionReady,false)
 const browser={__PUBLIC_BOOK_SEARCH_ENABLED__:false,__SHAMELA_SEARCH_V2_PACKED__:{original:true}}
 runInNewContext(result.scriptSource,{globalThis:browser,location:{origin:'https://preview.test'}})
 assert.equal(browser.__PUBLIC_BOOK_SEARCH_ENABLED__,true);assert.equal(browser.__KHIZANA_SEARCH_FIELDS__.expectedBooks,8594);assert.deepEqual(browser.__SHAMELA_SEARCH_V2_PACKED__,{original:true})
})
test('requires reviewed bytes, explicit candidate and real paired serverflag values',()=>{
 for(const change of [{candidate:'main'},{configSource:configSource+' '},{serverAcceptance:{}},{serverAcceptance:{PUBLIC_BOOK_SEARCH_ENABLED:'true',HEADING_QUERY_ENABLED:'1'}}])assert.throws(()=>injectBatch35SearchCandidate({...base,html,...change}))
})
test('rejects ordering hazards and uncompiled or duplicate modules',()=>{
 for(const bad of [html.replace('/assets/index-ab.js','/src/main.ts'),html.replace('</head>','<script src="/later-config.js"></script></head>'),html.replace('/theme-init.js"','/theme-init.js" async'),html.replace('</body>','<script type="module" src="/assets/other.js"></script></body>')])assert.throws(()=>injectBatch35SearchCandidate({...base,html:bad}))
 assert.doesNotThrow(()=>injectBatch35SearchCandidate({...base,html:html.replace('</head>','<script type="application/ld+json">{}</script></head>')}))
})

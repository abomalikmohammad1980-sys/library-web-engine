import {test} from 'node:test'
import assert from 'node:assert/strict'
import {assertSearchBootstrap} from '../scripts/search-bootstrap.mjs'
const bootstrap='<script defer src="/data/shamela-search-v2-packed.js"></script>'
const module='<script type="module" src="/assets/app.js"></script>'
test('deferred bootstrap requires explicit reviewed opt-in',()=>{
 assert.throws(()=>assertSearchBootstrap(bootstrap+module))
 assert.doesNotThrow(()=>assertSearchBootstrap(bootstrap+module,{allowDeferred:true}))
})
test('opt-in still rejects duplicate, late, async or missing module',()=>{
 for(const html of [bootstrap+bootstrap+module,module+bootstrap,bootstrap.replace('defer','async')+module,bootstrap+module.replace('type=','async type='),bootstrap])assert.throws(()=>assertSearchBootstrap(html,{allowDeferred:true}))
})

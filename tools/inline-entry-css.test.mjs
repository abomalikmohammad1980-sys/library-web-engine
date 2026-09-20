import {test} from 'node:test'
import assert from 'node:assert/strict'
import {inlineEntryCss} from './inline-entry-css.mjs'
test('preserves all CSS bytes, position and absolute font URLs',async()=>{
 const css='a{color:red;background:url(/assets/x.png)}a{color:blue}'
 const result=await inlineEntryCss('<head><link rel="stylesheet" crossorigin href="/assets/index-x.css"><style>a{color:green}</style></head>',async path=>{assert.equal(path,'assets/index-x.css');return css})
 assert.equal(result,'<head><style data-entry-css>'+css+'</style><style>a{color:green}</style></head>')
})
test('rejects escapes, relative resources and missing or ambiguous inputs',async()=>{
 for(const css of ['</style><script>x</script>','a{background:url(../x)}','@import "x";',''])await assert.rejects(()=>inlineEntryCss('<link rel="stylesheet" href="/assets/x.css">',async()=>css))
 await assert.rejects(()=>inlineEntryCss('',async()=>''))
})

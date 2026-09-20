import {test} from 'node:test'
import assert from 'node:assert/strict'
import {initialScreenCss} from './initial-screen-css.mjs'
import {readFileSync} from 'node:fs'
test('retains shared, mixed and home selectors in original order',()=>{
 const css='.btn{color:red}.reader-x,.btn{color:green}.home-page h1{font-size:2em}:not(.reader-x){color:blue}'
 assert.equal(initialScreenCss(css),css)
})
test('full original cascade loads before non-home render, with a reader retry on failure',()=>{
 const router=readFileSync(new URL('../app/src/router.ts',import.meta.url),'utf8')
 const full=readFileSync(new URL('../app/src/route_full_styles.ts',import.meta.url),'utf8')
 assert.match(router,/route.name==='home'\?Promise.resolve\(\):import\('\.\/route_full_styles'\)/)
 assert.match(router,/beforeRender.then\(\(\)=>loader\(route\)\)/)
 assert.match(router,/if\(route.name!=='home'\)await import\('\.\/route_full_styles'\)/)
 assert.match(router,/beforeRender.then\(\(\)=>\{if\(generation===renderGeneration\)return renderReader/)
 assert.match(router,/تحقق من الاتصال ثم أعد المحاولة/)
 assert(full.indexOf('components.css')<full.indexOf('screens.css'))
})
test('removes only positive exclusive screen rules, including nested media',()=>{
 const css='.reader-x{color:red}@media(max-width:600px){.quran-page{display:grid}.btn{color:blue}}.home-page{color:green}'
 assert.equal(initialScreenCss(css),'@media(max-width:600px){.btn{color:blue}}.home-page{color:green}')
})

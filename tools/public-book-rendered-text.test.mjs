import test from 'node:test'
import assert from 'node:assert/strict'
import {renderedSearchText} from './public-book-rendered-text.mjs'
const text=value=>({nodeType:3,nodeValue:value})
const el=(tag,...children)=>({nodeType:1,tagName:tag,childNodes:children.map(c=>typeof c==='string'?text(c):c)})
test('block, list, table and line break boundaries remain searchable words',()=>{
 assert.equal(renderedSearchText(el('DIV',el('H1','heading'),el('P','body'),el('UL',el('LI','one'),el('LI','two')),el('TABLE',el('TR',el('TD','left'),el('TD','right'))),el('P','first',el('BR'),'second'))),'heading\nbody\none\ntwo\nleft\nright\nfirst\nsecond')
})
test('inline emphasis preserves original word identity and Arabic text',()=>{
 assert.equal(renderedSearchText(el('DIV',el('P','stageb',el('STRONG','markdown'),'body'),el('P','{وَالْعَصْرِ} ',el('EM','نص'),' عربي'))),'stagebmarkdownbody\n{وَالْعَصْرِ} نص عربي')
})
test('non-content DOM nodes do not contribute executable or style text',()=>{
 assert.equal(renderedSearchText(el('DIV',el('P','real'),el('SCRIPT','secret'),el('STYLE','style'),el('TEMPLATE','template'))),'real')
})

import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {shamelaTextBlocks} from './shamela_page_render'

describe('shared BOK page presentation',()=>{
  it('separates body and footnotes at the same equals rule used by the reader',()=>{
    const blocks=shamelaTextBlocks('متن وفيه إحالة (١)\n===\n(١) نص الحاشية\n(٢) تتمة الحاشية')
    expect(blocks.map(block=>[block.separator??false,block.footnote,block.text])).toEqual([
      [false,false,'متن وفيه إحالة (١)'],
      [false,true,'(١) نص الحاشية'],
      [false,true,'(٢) تتمة الحاشية'],
    ])
  })
  it('uses the same body and note renderer in reader and search preview',()=>{
    const reader=readFileSync(new URL('./screens/reader.ts',import.meta.url),'utf8')
    const preview=readFileSync(new URL('./search_results_table.ts',import.meta.url),'utf8')
    expect(reader).toContain("from '../shamela_page_render'")
    expect(preview).toContain("from './shamela_page_render'")
    expect(preview).toContain("class:'reader__text-footnote-rule'")
    expect(reader).toContain('if(deepIndex!=null||focusIndex>0)routeAnimationFrame(()=>nav.goTo(focusIndex),resourceScope)')
  })
})

import {expect,it} from 'vitest'
import {readerPositionBinding} from './reader_position_label'
import {renderBoundUiTemplate} from './ui_template_binding'
import {readFileSync} from 'node:fs'
it('formats position chrome without changing the percentage calculation or authored label',()=>{
 for(const [current,total,percent,expected] of [[42,179,undefined,'Page 42 of 179 — 23% read'],[1,undefined,undefined,'Page 1'],['42',179,130,'Page 42 of 179 — 100% read'],['غلاف',undefined,undefined,'Page غلاف']] as const){
  const bound=readerPositionBinding(current,total,percent)
  expect(renderBoundUiTemplate(bound.id,bound.parameters,'en')).toBe(expected)
 }
})
it('binds reader status and result chrome explicitly while preserving literal snippets',()=>{
 const source=readFileSync('app/src/screens/reader.ts','utf8')
 expect(source).toContain("uiTemplateText('1393f9791e896eb9',{p1:index+1,p2:match.page})")
 expect(source).toContain("uiTemplateAttribute(button,'aria-label','c5714523a62a1c37',{p1:index+1,p2:match.page,p3:snippet})")
 expect(source).toContain("class: 'reader__search-result-snippet', dataset:{noTranslate:''}")
 expect(source).toContain('readerPositionText(sheet?.current??current, sheet?.total??total, percent)')
 expect(source).toContain("positionText.title = sheet?.printedHint ?? ''")
})

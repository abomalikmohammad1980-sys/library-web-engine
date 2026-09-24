import {expect,it} from 'vitest'
import {renderBoundUiTemplate,uiLabelParameter} from './ui_template_binding'
import {uiDictionary} from './ui_dictionary_loader'

it('localizes only the reviewed template and never recursively translates its supplied value',()=>{
 const value='الرئيسية <img src=x onerror=alert(1)> {p1}'
 expect(renderBoundUiTemplate('020859db294d941f',{p1:value},'en')).toBe(`Welcome, ${value}`)
 expect(renderBoundUiTemplate('020859db294d941f',{p1:value},'ar')).toBe(`مرحبًا ${value}`)
 expect(renderBoundUiTemplate('020859db294d941f',{p1:value},'zh')).toBe(`مرحبًا ${value}`)
})
it('rejects an unknown template or missing parameter instead of guessing from arbitrary text',()=>{
 expect(()=>renderBoundUiTemplate('book-content',{},'en')).toThrow('Unknown UI template')
 expect(()=>renderBoundUiTemplate('020859db294d941f',{},'en')).toThrow('Missing UI parameter')
 expect(renderBoundUiTemplate('020859db294d941f',{p1:'$&'},'en')).toBe('Welcome, $&')
})
it('translates an explicitly owned nested UI label but preserves the identical stored string',async()=>{
 await uiDictionary.ready()
 expect(renderBoundUiTemplate('020859db294d941f',{p1:uiLabelParameter('الرئيسية')},'en')).toBe('Welcome, Home')
 expect(renderBoundUiTemplate('020859db294d941f',{p1:'الرئيسية'},'en')).toBe('Welcome, الرئيسية')
})

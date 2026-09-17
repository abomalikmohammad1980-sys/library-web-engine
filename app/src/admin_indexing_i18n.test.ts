import {expect,it} from 'vitest'
import {ADMIN_INDEXING_EN} from './i18n/admin_indexing.en'
import {translateUiLabel} from './ui_translations'
it('registers the indexing panel English labels',()=>{
 for(const source of Object.keys(ADMIN_INDEXING_EN))expect(translateUiLabel(source,'en')).toBeTruthy()
 expect(translateUiLabel('حالة فهرسة الكتب','en')).toBe('Book indexing status')
})

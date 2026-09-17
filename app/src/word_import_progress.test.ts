import {it,expect} from 'vitest'
import {measuredWordPercent} from './word_import_progress'
import {wordMapImportFailure} from './word_import_diagnostic'
it('never invents a processing percentage or a missing/malformed total',()=>{
 expect(measuredWordPercent({stage:'processing',loaded:1,total:2})).toBeNull()
 for(const total of [undefined,0,-1,NaN,1.5])expect(measuredWordPercent({stage:'receiving',loaded:1,total})).toBeNull()
 expect(measuredWordPercent({stage:'receiving',loaded:11,total:10})).toBeNull()
 expect(measuredWordPercent({stage:'receiving',loaded:5,total:10})).toBe(50)
 expect(measuredWordPercent({stage:'receiving',loaded:10,total:10})).toBe(100)
})
it('keeps map mismatch fail-closed and adds useful non-content diagnostics',()=>{
 const source=new Error('internal mismatch');source.name='WordPageMapMismatchError'
 const result=wordMapImportFailure(source,30,31)
 expect(result.name).toBe(source.name);expect(result.cause).toBe(source)
 expect(result.message).toContain('30');expect(result.message).toContain('31');expect(result.message).toContain('DOCX')
 const unrelated=new Error('different');expect(wordMapImportFailure(unrelated,1,1)).toBe(unrelated)
})

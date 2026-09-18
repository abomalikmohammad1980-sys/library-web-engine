import {expect,it} from 'vitest'
import {snippetPhraseOffsets} from './search_phrase_snippet_matches'
it('returns each repeated phrase at its own original offset',()=>{
 const text='أَلَا إن سلعة الله، ثم قيل: ألا إن سلعة الله'
 expect(snippetPhraseOffsets(text,'ألا إن سلعة الله')).toEqual([0,text.lastIndexOf('ألا')])
})
it('preserves footnote-marker tolerance without substring matches',()=>{
 const text='قال (١) الله ثم فقال الله ثم قال الله'
 expect(snippetPhraseOffsets(text,'قال الله')).toEqual([0,text.lastIndexOf('قال')])
})
it('counts overlapping phrases and handles an empty query',()=>{
 expect(snippetPhraseOffsets('نور نور نور','نور نور')).toEqual([0,4])
 expect(snippetPhraseOffsets('نور','')).toEqual([])
})

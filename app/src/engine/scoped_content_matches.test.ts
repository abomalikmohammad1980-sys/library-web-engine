import {expect,it} from 'vitest'
import {matchScopedContent} from './scoped_content_matches'
it('never joins body with a note or two separate notes into a phrase',()=>{
 const content={complete:true,issues:[],segments:[{key:'body',kind:'body' as const,text:'عالم الغيب',anchorIndex:0},{key:'note:1',kind:'footnote' as const,text:'والشهادة',anchorIndex:0}]}
 expect(matchScopedContent(content,'الغيب والشهادة')).toEqual({matches:[],totalOccurrences:0,complete:true,issues:[]})
})
it('preserves note identity and reader anchor while counting only its own occurrences',()=>{
 const content={complete:true,issues:[],segments:[{key:'note:4',kind:'footnote' as const,text:'قال أحمد ثم قال أحمد',anchorIndex:8,noteId:'4'}]}
 const result=matchScopedContent(content,'قال احمد')
 expect(result.totalOccurrences).toBe(2)
 expect(result.matches[0]).toMatchObject({segmentKey:'note:4',anchorIndex:8,noteId:'4',occurrenceCount:2,text:content.segments[0].text})
})
it('retains incompleteness and does not count an empty query',()=>{
 const result=matchScopedContent({complete:false,issues:['unknown'],segments:[]},'')
 expect(result).toEqual({complete:false,issues:['unknown'],matches:[],totalOccurrences:0})
})

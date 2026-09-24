import {expect,it} from 'vitest'
import {ornamentalVerseRanges} from './textual_quran_style'
it('recognizes the reported book1449 verse without changing its original spelling',()=>{
 const verse='﴿وَمَنْ أَحْسَنُ قَوْلاً مِّمَّن دَعَا إِلَى اللَّهِ وَعَمِلَ صَالِحاً﴾'
 const text=`العلم إلى الجهاد، وتوخّي القول في الطاعة إلى العمل ${verse} [فصلت: ٣٣] .`
 const ranges=ornamentalVerseRanges(text)
 expect(ranges.map(r=>text.slice(r.start,r.end))).toEqual([verse])
 expect(text.slice(ranges[0]!.end)).toBe(' [فصلت: ٣٣] .')
})
it('selects only complete ornamental brackets without changing source text',()=>{
 const text='قال ﴿اعملوا آل داود شكرا﴾ [سبأ: ١٣] ثم ﴿الحمد لله﴾'
 expect(ornamentalVerseRanges(text).map(r=>text.slice(r.start,r.end))).toEqual(['﴿اعملوا آل داود شكرا﴾','﴿الحمد لله﴾'])
 expect(ornamentalVerseRanges('{نص} (نص) ﴿غير مكتمل')).toEqual([])
})

import {expect,it} from 'vitest'
import {SELECTABLE_TAFSIRS,tafsirDisplayName} from './quran_tafsir_registry'
import {getSourceEditionBookLink} from './quran_source_book_links'
it('retains every previously published tafsir, not only the older 28',()=>{
 expect(SELECTABLE_TAFSIRS).toHaveLength(35)
 for(const slug of ['shuoun-mathoor','abu-saud','durr-masun','nazm-durar','mawardi','ibn-arabi-ahkam','tarifi'])expect(SELECTABLE_TAFSIRS.some(d=>'slug'in d&&d.slug===slug)).toBe(true)
 const tarifi=SELECTABLE_TAFSIRS.find(d=>'slug'in d&&d.slug==='tarifi')!
 expect(tafsirDisplayName(tarifi)).toContain('معاصر')
})
it('keeps the ten explicitly accepted unavailable library destinations inactive',()=>{
 for(const [slug,positions]of Object.entries({mawardi:[[3,152],[26,55],[26,61],[34,16],[37,70],[37,162],[82,2]],'durr-masun':[[3,163],[9,11],[9,82]]}))for(const [s,a]of positions)expect(getSourceEditionBookLink(slug,s!,a!)).toBeUndefined()
})

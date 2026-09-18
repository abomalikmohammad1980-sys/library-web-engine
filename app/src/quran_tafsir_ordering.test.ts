import { describe, expect, it } from 'vitest'
import {readFileSync} from 'node:fs'
import {
  LINKED_TAFSIRS,
  TAFSIRS,
  TAFSIR_AUTHOR_CHRONOLOGY,
  isLinkedTafsir,
  tafsirDisplayName,
  SELECTABLE_TAFSIRS,
  tafsirDeathYear,
  ISTIAB_READY,
} from './quran_tafsir_registry'

describe('Quran tafsir selector chronology', () => {
  it('uses the central Qatada biography date while retaining the documented disagreement',()=>{
    const index=JSON.parse(readFileSync('app/public/data/shamela-author-index.json','utf8')),author=index.authors.find((a:any)=>a.authorId==='46')
    expect(author.name).toBe('قتادة بن دعامة السدوسي');expect(author.deathYearHijri).toBe(118)
    expect(TAFSIR_AUTHOR_CHRONOLOGY['shuoun-qatada'].deathYearHijri).toBe(author.deathYearHijri)
    expect(TAFSIR_AUTHOR_CHRONOLOGY['shuoun-qatada'].evidence).toContain('117هـ')
  })
  it('uses the requested compact contemporary label without inventing a death year',()=>{
    expect(tafsirDisplayName(ISTIAB_READY)).toBe('الاستيعاب في بيان الأسباب (معاصر)')
    expect(tafsirDisplayName(LINKED_TAFSIRS.find(d=>d.slug==='mokhtasar-tafsir')!)).toBe('المختصر في التفسير - مركز تفسير (معاصر)')
    expect(tafsirDeathYear(ISTIAB_READY)).toBe(Infinity)
  })
  it('never displays the collective author placeholder99999 as a death year',()=>{
    const definition={...LINKED_TAFSIRS[0]!,slug:'shuoun-mathoor',name:'موسوعة التفسير المأثور',author:'مجموعة من المؤلفين'}
    expect(tafsirDisplayName(definition)).toBe('موسوعة التفسير بالمأثور - مركز الشاطبي (معاصر)')
    expect(tafsirDeathYear(definition)).toBe(Infinity)
    expect(TAFSIR_AUTHOR_CHRONOLOGY['shuoun-mathoor']?.deathYearHijri).toBeUndefined()
  })
  it('interleaves original and imported tafsirs by evidenced death date, not import batch', () => {
    for(const definitions of [TAFSIRS,SELECTABLE_TAFSIRS]){
      const years=definitions.map(tafsirDeathYear)
      expect(years).toEqual([...years].sort((a,b)=>a-b))
      for(const item of definitions.filter(d=>'kind' in d&&d.kind==='source-edition-tafsir')){
        const chronology='slug'in item?TAFSIR_AUTHOR_CHRONOLOGY[item.slug]:undefined
        if(chronology?.contemporaryCollective)expect(tafsirDisplayName(item)).toContain('(معاصر)')
        else if(chronology?.contemporaryAuthor)expect(tafsirDisplayName(item)).toContain('(معاصر)')
        else expect(tafsirDisplayName(item)).toMatch(/ت [0-9]+ هـ/)
      }
    }
  })

  it('sorts dated active authors by Hijri death and keeps the contemporary institution last', () => {
    const active = TAFSIRS.filter(isLinkedTafsir)
    const years = active
      .map(definition => TAFSIR_AUTHOR_CHRONOLOGY[definition.slug]?.deathYearHijri)
      .filter((year): year is number => year !== undefined)
    const allDatedYears = LINKED_TAFSIRS
      .map(definition => TAFSIR_AUTHOR_CHRONOLOGY[definition.slug]?.deathYearHijri)
      .filter((year): year is number => year !== undefined)
    expect(years).toEqual([...allDatedYears].sort((left, right) => left - right))
    expect(new Set(years).size).toBe(allDatedYears.length)
    expect(active.at(-1)?.slug).toBe('mokhtasar-tafsir')
  })

  it('labels each active tafsir from one evidenced central chronology record', () => {
    for (const definition of LINKED_TAFSIRS) {
      const chronology = TAFSIR_AUTHOR_CHRONOLOGY[definition.slug]
      expect(chronology?.evidence.trim()).toBeTruthy()
      const label = tafsirDisplayName(definition)
      if (chronology.deathYearHijri) expect(label).toContain(`(ت ${chronology.deathYearHijri} هـ)`)
      else expect(label).toContain('(معاصر)')
    }
  })
})

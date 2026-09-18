import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {SELECTABLE_TAFSIRS,isIndexedVerseBook,isLinkedTafsir,isReadyBokTafsir} from './quran_tafsir_registry'
import {isSourceEditionTafsir} from './quran_source_editions'
it('includes indexed books once in the active selector rather than appending separate panels',()=>{
 const index=SELECTABLE_TAFSIRS.findIndex(isIndexedVerseBook)
 expect(index).toBeGreaterThanOrEqual(0)
 expect(SELECTABLE_TAFSIRS.filter(isIndexedVerseBook)).toHaveLength(1)
 expect(SELECTABLE_TAFSIRS.slice(0,index).every(x=>isLinkedTafsir(x)||isReadyBokTafsir(x)||isSourceEditionTafsir(x))).toBe(true)
 const screen=readFileSync('app/src/screens/quran.ts','utf8')
 expect(screen).toContain('cancelReady=loadIstiabReading(')
 expect(screen).toContain('()=>session.isCurrent(request,index)')
 expect(screen).not.toContain('tafsirRoot.append(asbab)')
 expect(screen).not.toContain('istiabPanel(')
})

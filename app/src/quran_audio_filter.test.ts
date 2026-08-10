import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { filterQuranAudioEntries, normalizeQuranAudioQuery, quranAudioEntryKey } from './quran_audio_filter'

const entries = [
  { reciter: 'محمود خليل الحصري', riwaya: 'ورش عن نافع' },
  { reciter: 'عبد الباسط عبد الصمد', riwaya: 'ورش عن نافع' },
  { reciter: 'محمد رفعت', riwaya: 'قالون عن نافع' },
  { reciter: 'الحذيفي', riwaya: 'حفص عن عاصم' },
]

describe('Quran audio reciter filtering', () => {
  it('returns every matching reciter for a riwaya instead of one option', () => {
    expect(filterQuranAudioEntries(entries, 'ورش').map(item => item.index)).toEqual([0, 1])
    expect(filterQuranAudioEntries(entries, 'قالون')).toHaveLength(1)
  })

  it('normalizes Arabic variants and supports multi-term filtering', () => {
    expect(normalizeQuranAudioQuery('وَرْش عَنْ نَافِع')).toBe('ورش عن نافع')
    expect(filterQuranAudioEntries(entries, 'ورش نافع')).toHaveLength(2)
  })

  it('preserves original indexes and stable preference keys after filtering', () => {
    const result = filterQuranAudioEntries(entries, 'حفص')
    expect(result[0]?.index).toBe(3)
    expect(quranAudioEntryKey(result[0]!.entry)).toBe('الحذيفي|حفص عن عاصم')
  })

  it('keeps the player speed and preference persistence wired', () => {
    const screen = readFileSync(new URL('./screens/quran.ts', import.meta.url), 'utf8')
    expect(screen).toContain('[.75, 1, 1.25, 1.5, 2]')
    expect(screen).toContain('player.playbackRate = Number(speed.value)')
    expect(screen).toContain('saveQuranAudioReader(preferredAudioKey)')
    expect(screen).toContain('loadQuranAudioReader()')
    expect(screen).toContain('const picked = selectedAudioEntry()')
    expect(screen).toContain('filterStatus.textContent = query ?')
  })
})

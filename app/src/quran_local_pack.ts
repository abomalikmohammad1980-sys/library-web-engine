import type { QuranSearchCandidate } from './quran_search_contract'

export const QURAN_LOCAL_PACK_KEY = 'alkhizana:quran:quranpedia-metadata:v1'

/** عينة وصفية من عقد Quranpedia Q1؛ لا تحتوي نصًا قرآنيًا. */
export const QURANPEDIA_METADATA_FIXTURE = Object.freeze({
  id: 'quranpedia-hafs-uthmani-fatiha-demo', provider: 'الموسوعة القرآنية Quranpedia', sourceUrl: 'https://api.quranpedia.net/v1/mushafs/2/1', apiVersion: 'v1',
  retrievedAt: '2026-08-09T02:19:56.788Z', licenseId: 'USER-ATTESTED-WAQF-REUSE', checksumSha256: '60840ea24fbd35eff147aed1ca29380de99c175b5bf8d1c9d582c36ed63a58b9', sourceChecksumSha256: 'b79e60c69a283cf1a3e2d98337e36bb83534e779349e103ef269aefbf1bfeef0', publicationStatus: 'publishable-user-attested-waqf-reuse',
  mushafs: [{ id: 'fixture-hafs', name: 'حفص' }],
  surahs: [{ number: 1, name: 'الفاتحة', ayahCount: 7 }],
  ayahs: [
    ['1:1', 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ'], ['1:2', 'ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ'],
    ['1:3', 'ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ'], ['1:4', 'مَٰلِكِ يَوۡمِ ٱلدِّينِ'],
    ['1:5', 'إِيَّاكَ نَعۡبُدُ وَإِيَّاكَ نَسۡتَعِينُ'], ['1:6', 'ٱهۡدِنَا ٱلصِّرَٰطَ ٱلۡمُسۡتَقِيمَ'],
    ['1:7', 'صِرَٰطَ ٱلَّذِينَ أَنۡعَمۡتَ عَلَيۡهِمۡ غَيۡرِ ٱلۡمَغۡضُوبِ عَلَيۡهِمۡ وَلَا ٱلضَّآلِّينَ'],
  ].map(([id, uthmani]) => ({ id: id!, uthmani: uthmani! })) as readonly { id: string; uthmani: string }[],
})

export type QuranPackStatus = 'available' | 'installed'
export function quranPackStatus(storage: Pick<Storage, 'getItem'> = localStorage): QuranPackStatus { return storage.getItem(QURAN_LOCAL_PACK_KEY) === QURANPEDIA_METADATA_FIXTURE.id ? 'installed' : 'available' }
export function installQuranMetadataPack(storage: Pick<Storage, 'setItem'> = localStorage): void { storage.setItem(QURAN_LOCAL_PACK_KEY, QURANPEDIA_METADATA_FIXTURE.id) }
export function removeQuranMetadataPack(storage: Pick<Storage, 'removeItem'> = localStorage): void { storage.removeItem(QURAN_LOCAL_PACK_KEY) }
export function quranFixtureSearchCandidates(): readonly QuranSearchCandidate[] { return QURANPEDIA_METADATA_FIXTURE.ayahs.map(ayah => ({ id: ayah.id, text: ayah.uthmani })) }

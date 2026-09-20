/** Browsing/reading can use current labels; editors/filter directories need
 * the current category registry before constructing their controls. */
export function routeNeedsMetadataBeforeRender(route:string):boolean {
 // Sunnah builds its filters from its verified scope and enriches author dates
 // asynchronously; the global editable registry is not a prerequisite.
 return !new Set(['home','features','welcome','quran','quran-tafsir','sunnah','reader','not-found']).has(route)
}

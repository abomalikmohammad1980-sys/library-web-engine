/** Browsing/reading can use current labels; editors/filter directories need
 * the current category registry before constructing their controls. */
export function routeNeedsMetadataBeforeRender(route:string):boolean {
 return !new Set(['home','features','welcome','quran','quran-tafsir','reader','not-found']).has(route)
}

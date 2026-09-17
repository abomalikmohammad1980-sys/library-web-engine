import type { WordPageMap } from './engine/library_store'

/** لا تُعلن مطابقة Word إلا بخريطة صفحات موثقة لكل ملف/جزء. */
export function hasAuthoritativeWordPageMaps(maps: Array<WordPageMap | undefined>, partCount: number): boolean {
  return maps.length === partCount && maps.every(map => Boolean(
    map && Number.isInteger(map.totalPages) && map.totalPages > 0 && Array.isArray(map.starts) && map.starts.length > 0,
  ))
}

/* أيقونات SVG خطية — stroke-width 1.7، زوايا مدورة، بلون النص الحالي (دستور §7) */

export type IconName =
  | 'search'
  | 'book'
  | 'compass'
  | 'person'
  | 'chevron-left'
  | 'chevron-right'
  | 'arrow-back'
  | 'bookmark'
  | 'more'
  | 'settings'
  | 'list'
  | 'sun'
  | 'moon'
  | 'drop'
  | 'font-size'
  | 'close'
  | 'box'
  | 'share'
  | 'clock'
  | 'download'
  | 'plus'
  | 'check'
  | 'copy'
  | 'globe'

const MARKUP: Record<IconName, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.6-4.6"/>',
  book: '<path d="M12 6.5c-2.4-2-5.8-2.4-8.5-1.8v13.4c2.7-.6 6.1-.2 8.5 1.8 2.4-2 5.8-2.4 8.5-1.8V4.7c-2.7-.6-6.1-.2-8.5 1.8z"/><path d="M12 6.5v13.4"/>',
  compass: '<circle cx="12" cy="12" r="9.5"/><path d="m16.2 7.8-2.4 5.8-5.9 2.6 2.3-5.9z"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5"/>',
  'chevron-left': '<path d="m14.5 6-6 6 6 6"/>',
  'chevron-right': '<path d="m9.5 6 6 6-6 6"/>',
  'arrow-back':
    '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
  bookmark: '<path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  settings:
    '<path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.2A8.2 8.2 0 1 1 9.8 4a6.6 6.6 0 0 0 10.2 10.2z"/>',
  drop: '<path d="M12 3.5s6 6.3 6 10.2a6 6 0 0 1-12 0C6 9.8 12 3.5 12 3.5z"/>',
  'font-size': '<path d="M5 19.5 9 7l4 12.5"/><path d="M6.6 15.5h4.9"/><path d="M17 8.5V19"/><path d="M15.5 11h3"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  box: '<path d="M21 8.2 12 3 3 8.2v7.6L12 21l9-5.2z"/><path d="M3.3 8.5 12 13l8.7-4.5M12 13v8"/>',
  share: '<path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M5 12v6a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18v-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 3v11"/><path d="m7.5 9.5 4.5 4.5 4.5-4.5"/><path d="M4 20h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
}

export function icon(name: IconName, size = 24, className = ''): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.7')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  if (className) svg.setAttribute('class', className)
  svg.innerHTML = MARKUP[name]
  return svg
}

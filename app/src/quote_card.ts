import brandLogoUrl from './assets/brand-logo-share.png?inline'

export type QuoteCardTheme = 'paper' | 'night' | 'ornament'
export interface QuoteCardData { quote: string; book: string; author?: string; page: number; theme?: QuoteCardTheme }

export function quoteCardSvg(data: QuoteCardData): string {
  const theme = data.theme ?? 'paper'
  const colors = theme === 'night' ? ['#211E1A', '#D8D2C4', '#6FAF8F'] : theme === 'ornament' ? ['#EAF1EC', '#23211C', '#2F6F54'] : ['#FAF8F3', '#26241F', '#2F6F54']
  const lines = wrap(data.quote.trim(), 42).slice(0, 7)
  const text = lines.map((line, index) => `<text x="540" y="${245 + index * 58}" text-anchor="middle" direction="rtl" fill="${colors[1]}" font-family="serif" font-size="36">${escapeXml(line)}</text>`).join('')
  const source = `${data.book}${data.author ? ` — ${data.author}` : ''} · ص ${data.page}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" role="img" aria-label="بطاقة اقتباس موثقة"><rect width="1080" height="1080" fill="${colors[0]}"/><rect x="46" y="46" width="988" height="988" rx="30" fill="none" stroke="${colors[2]}" stroke-width="3"/><path d="M120 130h840M120 950h840" stroke="${colors[2]}" opacity=".45"/>${text}<text x="540" y="820" text-anchor="middle" direction="rtl" fill="${colors[2]}" font-family="sans-serif" font-size="25">${escapeXml(source)}</text><image href="${brandLogoUrl}" x="510" y="884" width="60" height="70" preserveAspectRatio="xMidYMid meet"/><text x="540" y="980" text-anchor="middle" direction="rtl" fill="${colors[2]}" font-family="serif" font-size="25" font-weight="bold">الخِزانة</text></svg>`
}

export function quoteCardDataUrl(data: QuoteCardData): string { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(quoteCardSvg(data))}` }

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/); const lines: string[] = []; let line = ''
  for (const word of words) { const next = line ? `${line} ${word}` : word; if (next.length > width && line) { lines.push(line); line = word } else line = next }
  if (line) lines.push(line)
  return lines
}
function escapeXml(value: string): string { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!) }

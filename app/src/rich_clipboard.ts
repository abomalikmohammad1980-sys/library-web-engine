export interface RichClipboardPayload { plain: string; html: string }

export function buildRichClipboard(text: string, source: string, selectionHtml?: string): RichClipboardPayload {
  const cleanText = text.trim()
  const cleanSource = source.trim()
  const { quotedText, terminalPeriod } = splitTerminalPeriod(cleanText)
  // لا نستعمل غلاف HTML المحدد مباشرة؛ فقد يحتوي عناصر كتلية تجعل « و»
  // سطرين مستقلين عند اللصق في Word. النص المنظف يحفظ الأسطر من دون هذا الخلل.
  const body = escapeHtml(quotedText).replace(/\r?\n/g, '<br>')
  const quoted = cleanSource ? `«${quotedText}»${terminalPeriod}` : cleanText
  return {
    plain: cleanSource ? `${quoted}\n[${cleanSource}]` : cleanText,
    html: `<blockquote dir="rtl" lang="ar" style="margin:0;border-inline-start:3px solid #2f6f54;padding-inline-start:1em"><div>${cleanSource ? '«' : ''}${body}${cleanSource ? `»${terminalPeriod}` : ''}</div>${cleanSource ? `<footer style="margin-block-start:0;color:#5f625d">[${escapeHtml(cleanSource)}]</footer>` : ''}</blockquote>`,
  }
}

function splitTerminalPeriod(value: string): { quotedText: string; terminalPeriod: string } {
  if (!/[.۔]$/u.test(value)) return { quotedText: value, terminalPeriod: '' }
  return { quotedText: value.slice(0, -1).trimEnd(), terminalPeriod: value.slice(-1) }
}

export async function writeRichClipboard(payload: RichClipboardPayload): Promise<'rich' | 'plain'> {
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([new ClipboardItem({
      'text/plain': new Blob([payload.plain], { type: 'text/plain;charset=utf-8' }),
      'text/html': new Blob([payload.html], { type: 'text/html;charset=utf-8' }),
    })])
    return 'rich'
  }
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard API غير متاحة')
  await navigator.clipboard.writeText(payload.plain)
  return 'plain'
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

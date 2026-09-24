/** Keep the same paragraph offsets/text as textParagraphs, while retaining
 * source headings as references. Never invent printed page/volume numbers. */
export function markdownSearchParagraphs(source: string): Array<{ index: number; text: string; sectionHeading?: string }> {
  const rows: Array<{ index: number; text: string; sectionHeading?: string }> = []
  const headings: Array<string | undefined> = []
  let fence: { char: string; length: number } | undefined
  for (const block of source.split(/\n{2,}/)) {
    const text = block.replace(/\n/g, ' ').trim()
    if (!text) continue
    for (const line of block.split('\n')) {
      const boundary = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
      if (boundary) {
        if (!fence) fence = { char: boundary[1]![0]!, length: boundary[1]!.length }
        else if (boundary[1]![0] === fence.char && boundary[1]!.length >= fence.length && !boundary[2]!.trim()) fence = undefined
        continue
      }
      if (fence) continue
      const heading = /^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/.exec(line)
      if (!heading) continue
      headings.length = heading[1]!.length
      headings[heading[1]!.length - 1] = heading[2]!.replace(/[ \t]+#+[ \t]*$/, '').trim()
    }
    const sectionHeading = headings.filter(Boolean).join(' · ')
    rows.push({ index: rows.length, text, ...(sectionHeading ? { sectionHeading } : {}) })
  }
  return rows
}

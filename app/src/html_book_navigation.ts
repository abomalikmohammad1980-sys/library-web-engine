/** Fragment links stay within their own book, never change the application route. */
export function followHtmlBookAnchor(event: MouseEvent, container: HTMLElement): boolean {
  const origin = event.target instanceof Element ? event.target : null
  const link = origin?.closest<HTMLAnchorElement>('a[href^="#html-book-"]')
  if (!link || !container.contains(link)) return false
  event.preventDefault()
  const id = link.getAttribute('href')!.slice(1)
  // IDs belong to imported content: do not interpret them as CSS selectors
  // or accidentally select the same ID in another open book preview.
  const target = [...container.querySelectorAll<HTMLElement>('[id]')].find(node => node.id === id)
  if (!target) return false
  target.scrollIntoView({ behavior: 'auto', block: 'center' })
  return true
}

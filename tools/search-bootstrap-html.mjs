/** Deferred classic bootstrap precedes the non-async module in document order. */
export function injectSearchBootstrap(html, { defer = true } = {}) {
  if (html.includes('shamela-search-v2-packed.js')) throw Error('duplicate_search_bootstrap')
  const module = html.match(/<script\b[^>]*type="module"[^>]*>/)
  if (!module || /\basync(?:\s|=|>)/.test(module[0])) throw Error('ordered_module_required')
  return html.replace(module[0], `<script${defer ? ' defer' : ''} src="/data/shamela-search-v2-packed.js"></script>\n    ${module[0]}`)
}

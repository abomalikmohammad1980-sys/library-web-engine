import {createHash} from 'node:crypto'

/** Preserve the exact pre-paint bootstrap while removing its network round trip.
 * Authorize only these bytes; never broaden CSP with unsafe-inline. */
export function inlineThemeBootstrap(index, headers, source) {
  const tag = '<script src="/theme-init.js"></script>'
  if (index.split(tag).length !== 2) throw Error('theme_bootstrap_tag_count')
  if (!source || Buffer.byteLength(source) > 8192 || /<\/script/i.test(source)) throw Error('theme_bootstrap_source_invalid')
  // HTML parsers normalize CRLF before applying CSP hashes.
  const script = source.replace(/\r\n?/g, '\n')
  const hash = "'sha256-" + createHash('sha256').update(script).digest('base64') + "'"
  if ((headers.match(/script-src [^;\r\n]+/g) ?? []).length !== 1) throw Error('theme_bootstrap_csp_count')
  headers = headers.replace(/script-src ([^;\r\n]+)/, (all, policy) => {
    if (policy.includes("'unsafe-inline'")) throw Error('theme_bootstrap_csp_unsafe')
    return all + ' ' + hash
  })
  return {index: index.replace(tag, '<script data-theme-bootstrap>' + script + '</script>'), headers, hash}
}

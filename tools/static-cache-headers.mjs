/** Pages joins matching values; a global no-cache defeats immutable assets. */
export function scopeStaticCacheHeaders(source, paths) {
  const normalized = source.replaceAll('\r\n', '\n')
  const blocks = normalized.split(/\n\s*\n/)
  if (!blocks[0].startsWith('/*\n') || !blocks[0].includes('  Cache-Control: no-cache')) throw Error('global_cache_rule_changed')
  blocks[0] = blocks[0].replace('\n  Cache-Control: no-cache', '')
  const patterns = new Set()
  for (const path of paths) {
    if (path.startsWith('assets/') || path.startsWith('_')) continue
    if (path.startsWith('/') || path.includes('..')) throw Error('cache_path')
    patterns.add('/' + (path.includes('/') ? path.split('/')[0] + '/*' : path))
  }
  if (blocks.length + patterns.size > 100) throw Error('cache_rule_budget')
  return blocks.join('\n\n').trimEnd() + '\n\n' + [...patterns].sort().map(path => `${path}\n  Cache-Control: no-cache`).join('\n\n') + '\n'
}

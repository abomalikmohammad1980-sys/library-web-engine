import { readFile } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import { createHash } from 'node:crypto'

export function cacheableUiFont(path) {
  return /^\/fonts\/thmanyah\/[a-zA-Z0-9-]+\.woff2$/.test(path) || path === '/fonts/hafs-uthmani.ttf'
}

export function hashedFontPath(path, bytes) {
  if (!cacheableUiFont(path)) throw Error('unreviewed_ui_font')
  return `assets/fonts/${createHash('sha256').update(bytes).digest('hex').slice(0, 20)}-${basename(path)}`
}

/** Version CSS font URLs before Vite computes the CSS hash; bytes stay identical. */
export function versionedUiFonts(publicRoot) {
  const mappings = new Map(), pending = new Map()
  return {
    name: 'khizana-versioned-ui-fonts', enforce: 'pre', apply: 'build',
    originalPaths: mappings,
    async transform(code, id) {
      if (!id.split('?')[0].endsWith('.css')) return null
      const paths = [...new Set([...code.matchAll(/url\(\s*['"]?(\/fonts\/[a-zA-Z0-9/_-]+\.(?:woff2|ttf))['"]?\s*\)/g)].map(match => match[1]).filter(cacheableUiFont))]
      for (const path of paths) {
        if (!pending.has(path)) pending.set(path, (async () => {
          const bytes = await readFile(resolve(publicRoot, path.slice(1)))
          const target = hashedFontPath(path, bytes)
          this.emitFile({ type: 'asset', fileName: target, source: bytes })
          mappings.set(path, target)
          return target
        })())
        const target = await pending.get(path)
        code = code.replaceAll(path, '/' + target)
      }
      return paths.length ? { code, map: null } : null
    },
    async generateBundle() {
      const rows = [...mappings].sort(([a], [b]) => a.localeCompare(b)).map(([original, target]) => ({ original, target }))
      const base = await readFile(resolve(publicRoot, '_redirects'), 'utf8')
      this.emitFile({ type: 'asset', fileName: '_redirects', source: base.trimEnd() + '\n' + rows.map(row => `${row.original} /${row.target} 301`).join('\n') + '\n' })
      this.emitFile({ type: 'asset', fileName: 'font-cache-map.json', source: JSON.stringify(rows, null, 2) })
    },
  }
}

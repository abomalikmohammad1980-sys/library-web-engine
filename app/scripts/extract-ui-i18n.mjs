import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'

const appRoot = resolve(import.meta.dirname, '..')
const sourceRoot = resolve(appRoot, 'src')
const output = resolve(sourceRoot, 'i18n/source-ar.json')
const excluded = /(?:\.test\.ts$|[\\/]engine[\\/]|ui_translations\.ts$)/
const arabic = /[\u0600-\u06ff]/
const quoted = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g
const entries = new Map()

async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name)
    if (item.isDirectory()) await walk(path)
    else if (['.ts', '.tsx'].includes(extname(item.name)) && !excluded.test(path)) {
      const source = await readFile(path, 'utf8')
      for (const match of source.matchAll(quoted)) {
        const value = match[2]?.replace(/\\n/g, '\n').trim()
        if (!value || !arabic.test(value) || value.includes('${') || value.length > 280) continue
        const key = value.replace(/\s+/g, ' ')
        const files = entries.get(key) ?? new Set()
        files.add(relative(sourceRoot, path).replaceAll('\\', '/'))
        entries.set(key, files)
      }
    }
  }
}

await walk(sourceRoot)
const messages = Object.fromEntries([...entries.entries()].sort(([a], [b]) => a.localeCompare(b, 'ar')).map(([key, files]) => [key, { files: [...files].sort() }]))
await mkdir(resolve(sourceRoot, 'i18n'), { recursive: true })
await writeFile(output, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), messageCount: Object.keys(messages).length, messages }, null, 2)}\n`, 'utf8')
console.log(`Arabic UI inventory: ${Object.keys(messages).length} messages -> ${output}`)

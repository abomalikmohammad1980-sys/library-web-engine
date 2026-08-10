import fs from 'node:fs'
import path from 'node:path'
import { getDocument } from '../app/node_modules/pdfjs-dist/legacy/build/pdf.mjs'

const root = path.resolve(import.meta.dirname, '../app')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/library/published/manifest.json'), 'utf8'))
const results = []

for (const work of manifest.works) {
  for (const source of work.sources.filter((item) => item.format === 'pdf')) {
    const file = path.join(root, 'public', source.path.replace(/^\.\//, ''))
    try {
      const task = getDocument({ data: new Uint8Array(fs.readFileSync(file)), disableWorker: true, useWasm: false })
      const document = await task.promise
      const page = await document.getPage(1)
      await page.getOperatorList()
      results.push({ title: work.title, pages: document.numPages, status: 'ok' })
      await task.destroy()
    } catch (error) {
      results.push({ title: work.title, status: 'error', error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) })
    }
  }
}

console.log(JSON.stringify(results, null, 2))
if (results.some((item) => item.status === 'error')) process.exitCode = 1

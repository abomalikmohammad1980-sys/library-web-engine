import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const language = process.argv[2] || 'en'
if (!/^[a-z]{2,3}$/i.test(language)) throw new Error('invalid_language_code')
const appRoot = resolve(import.meta.dirname, '..')
const inventory = JSON.parse(await readFile(resolve(appRoot, 'src/i18n/source-ar.json'), 'utf8'))
const labels = Object.keys(inventory.messages).filter(value => /[\u0600-\u06ff]/.test(value) && value.length <= 280)
const translated = {}

function chunks(values) {
  const output = []; let group = [], size = 0
  for (const value of values) {
    const next = value.length + 24
    if (group.length && (size + next > 4200 || group.length >= 35)) { output.push(group); group = []; size = 0 }
    group.push(value); size += next
  }
  if (group.length) output.push(group)
  return output
}

async function translate(group, attempt = 0) {
  const source = group.map((value, index) => `[[KHZ_${index + 1}]] ${value}`).join('\n')
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=${language}&dt=t&q=${encodeURIComponent(source)}`
  const response = await fetch(url)
  if (!response.ok) {
    if (attempt < 3) { await new Promise(resolveDelay => setTimeout(resolveDelay, 800 * (attempt + 1))); return translate(group, attempt + 1) }
    throw new Error(`translation_http_${response.status}`)
  }
  const payload = await response.json()
  const text = (payload[0] ?? []).map(part => part?.[0] ?? '').join('')
  const markers = [...text.matchAll(/\[\[KHZ_(\d+)\]\]\s*/g)]
  if (markers.length !== group.length) throw new Error(`translation_marker_mismatch:${markers.length}/${group.length}`)
  for (let index = 0; index < markers.length; index += 1) {
    const start = markers[index].index + markers[index][0].length
    const end = markers[index + 1]?.index ?? text.length
    translated[group[Number(markers[index][1]) - 1]] = text.slice(start, end).trim()
  }
}

const groups = chunks(labels)
for (let index = 0; index < groups.length; index += 1) {
  await translate(groups[index])
  if ((index + 1) % 10 === 0 || index + 1 === groups.length) console.log(`${language}: ${index + 1}/${groups.length}`)
  await new Promise(resolveDelay => setTimeout(resolveDelay, 120))
}
const banner = `// مولد آليًا من مخزون الواجهة العربية؛ تُقدّم عليه الترجمات اليدوية المراجعة.\n`
await writeFile(resolve(appRoot, `src/i18n/${language}.generated.ts`), `${banner}export const GENERATED_${language.toUpperCase()}_UI: Record<string, string> = ${JSON.stringify(translated, null, 2)}\n`, 'utf8')
console.log(`Static ${language} UI catalog: ${Object.keys(translated).length} labels`)

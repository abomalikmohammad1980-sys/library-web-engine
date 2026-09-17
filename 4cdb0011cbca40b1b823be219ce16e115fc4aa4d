import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const cacheDir = path.join(root, 'tmp', 'shamela-authors-cache')
const outputPath = path.join(root, 'app', 'public', 'data', 'shamela-authors.json')
const origin = 'https://shamela.ws'
const concurrency = Math.max(1, Math.min(5, Number(process.env.SHAMELA_CONCURRENCY) || 3))
const offline = process.env.SHAMELA_OFFLINE === '1'
await mkdir(cacheDir, { recursive: true })
await mkdir(path.dirname(outputPath), { recursive: true })

function decode(value) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ').trim()
}

function arabicDigits(value) {
  return value.replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
}

async function fetchCached(url, cacheName) {
  const target = path.join(cacheDir, cacheName)
  if (existsSync(target)) return readFile(target, 'utf8')
  if (offline) throw new Error('pending-enrichment')
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'AlKhizanaMetadataImporter/1.0 (+local research library; respectful cached fetch)' } })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  const html = await response.text()
  await writeFile(target, html, 'utf8')
  return html
}

function parseIndex(html) {
  const found = new Map()
  const pattern = /href=["'](?:https:\/\/shamela\.ws)?\/author\/(\d+)["'][^>]*>([\s\S]*?)<\/a>([\s\S]{0,240}?)(?:عدد الكتب|books-count)[^\d٠-٩]{0,20}([\d٠-٩]+)?/gi
  for (const match of html.matchAll(pattern)) {
    const id = match[1]
    const name = decode(match[2])
    if (!id || name.length < 2) continue
    const countText = arabicDigits(match[4] || '')
    found.set(id, { id: `shamela-${id}`, shamelaId: id, name, aliases: [], sourceUrl: `${origin}/author/${id}`, shamelaBookCount: countText ? Number(countText) : 0 })
  }
  // بعض القوالب لا تضع عدد الكتب في نفس العقدة؛ لا نسقط المؤلف بسبب ذلك.
  for (const match of html.matchAll(/href=["'](?:https:\/\/shamela\.ws)?\/author\/(\d+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const id = match[1]
    const name = decode(match[2])
    if (id && name.length >= 2 && !found.has(id)) found.set(id, { id: `shamela-${id}`, shamelaId: id, name, aliases: [], sourceUrl: `${origin}/author/${id}`, shamelaBookCount: 0 })
  }
  return [...found.values()]
}

function parseAuthorPage(html, base) {
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? html
  const heading = main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const name = heading ? decode(heading[1]) : base.name
  const books = []
  const seen = new Set()
  const beforeBio = main.split(/تعريف بالمؤلف/i)[0]
  for (const match of beforeBio.matchAll(/href=["'](?:https:\/\/shamela\.ws)?\/book\/(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (seen.has(match[1])) continue
    seen.add(match[1])
    books.push({ id: match[1], title: decode(match[2]) })
  }
  const bioMatch = main.match(/تعريف بالمؤلف[\s\S]*?<\/h\d>([\s\S]*?)(?=<h[234]\b[^>]*>(?:البحث في:|بحث)|<footer\b|$)/i)
  const biography = bioMatch ? decode(bioMatch[1]) : undefined
  const normalizedBio = arabicDigits(biography || '')
  const opening = normalizedBio.slice(0, 360)
  const openingRange = opening.match(/\b\d{2,4}\s*[-–—]\s*(\d{2,4})\s*هـ/)
  const openingDeath = opening.match(/(?:ت\s*|وفاة[^\d]{0,12})(\d{2,4})\s*هـ/)
  const anyDeath = normalizedBio.match(/(?:ت\s*|وفاة[^\d]{0,12})(\d{2,4})\s*هـ/)
  const deathYear = Number(openingRange?.[1] ?? openingDeath?.[1] ?? anyDeath?.[1] ?? 0)
  return {
    ...base,
    name,
    ...(biography ? { biography } : {}),
    ...(deathYear > 0 && deathYear < 2000 ? { deathYearHijri: deathYear } : {}),
    shamelaBooks: books,
    shamelaBookCount: Math.max(base.shamelaBookCount || 0, books.length),
  }
}

const indexHtml = await fetchCached(`${origin}/authors`, 'authors-index.html')
const authors = parseIndex(indexHtml)
if (!authors.length) throw new Error('لم يُستخرج أي مؤلف من فهرس الشاملة؛ أوقف الاستيراد حمايةً من إخراج فارغ')
let cursor = 0
let completed = 0
const results = new Array(authors.length)

async function worker() {
  while (true) {
    const index = cursor++
    if (index >= authors.length) return
    const author = authors[index]
    try {
      const html = await fetchCached(author.sourceUrl, `author-${author.shamelaId}.html`)
      results[index] = parseAuthorPage(html, author)
    } catch (error) {
      results[index] = { ...author, importError: error instanceof Error ? error.message : String(error) }
    }
    completed++
    if (completed % 50 === 0 || completed === authors.length) process.stdout.write(`\r${completed}/${authors.length}`)
    // التأخير لحماية المصدر عند الجلب الشبكي فقط؛ إعادة البناء من الكاش محلية.
    if (!offline) await new Promise(resolve => setTimeout(resolve, 120))
  }
}

await Promise.all(Array.from({ length: concurrency }, worker))
const payload = {
  schemaVersion: 1,
  source: `${origin}/authors`,
  fetchedAt: new Date().toISOString(),
  authors: results,
}
await writeFile(outputPath, JSON.stringify(payload), 'utf8')
process.stdout.write(`\nSaved ${results.length} authors to ${outputPath}\n`)

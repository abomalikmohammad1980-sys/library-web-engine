import { defineConfig, loadEnv, type Plugin } from 'vite'
import {satelliteBuildConfiguration,satelliteBuildMarker} from '../alpha-publish/scripts/satellite-build-config.mjs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createReadStream } from 'node:fs'
import { lstat, readFile, realpath, stat } from 'node:fs/promises'
import { cp, copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import {buildTarajmPersonAssets} from '../tools/build-tarajm-person-assets.mjs'
import {stageOptionalHeadingRelease} from '../alpha-publish/scripts/heading-release-stage.mjs'
import {stageShamelaBiographies} from '../alpha-publish/scripts/shamela-biography-stage.mjs'
import {checkCatalogSnapshot} from '../tools/build-shamela-catalog-snapshot.mjs'
import {checkHeadingCatalogCoverage} from '../tools/heading-catalog-coverage-gate.mjs'
import authorPersonRelease from './src/author_person_release.json'
import headingCatalogSupplement from './src/heading_catalog_supplement.generated.json'
import headingDictionaryRelease from './src/heading_dictionary_release.generated.json'
import {homeLibraryStatistics} from '../tools/home-library-statistics.mjs'
import {wordConversionMultipart} from '../tools/word-conversion-response.mjs'
import {interfaceFontScale} from '../tools/interface-font-scale.mjs'
import {versionedUiFonts} from '../tools/versioned-ui-fonts.mjs'
import {routePreloadHints} from '../tools/route-preload-hints.mjs'
import {initialScreenCssPlugin} from '../tools/initial-screen-css.mjs'
import sourceEditionPacks from './src/quran_source_packs.generated.json'
import {copySourceEditionAsset} from '../tools/source-edition-packs.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const uiFontAssets = versionedUiFonts(resolve(__dirname, 'public'))
const PROJECT_ROOT = resolve(__dirname, '../../..')
const SHAMELA_CORPUS_ROOT = resolve(PROJECT_ROOT, 'بيانات-المشروع/shamela/published-corpus-v1')
const SHAMELA_CHECKPOINT = resolve(SHAMELA_CORPUS_ROOT, 'orchestration.checkpoint.json')

export const ESSENTIAL_PUBLIC_ASSETS = [
  'brand-logo-color.png', 'brand-logo-color.webp', 'brand-logo-mono.png', 'favicon-64.png',
  'favicon.svg', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml', 'sw.js', 'theme-init.js', '.well-known',
  'fonts', 'icons', 'morphology', 'pdfjs', 'quran', 'sunnah', 'downloads/khizana-word-companion-windows.zip',
  'data/author-supplement.json', 'data/shamela-author-index.json', 'data/shamela-author-metadata.json',
  'data/shamela-authors.json', 'data/shamela-gateways.json',
  'data/shamela-catalog.snapshot.json',
  headingDictionaryRelease.baseURL.replace(/^\.\//,'').replace(/\/$/,''),
  headingCatalogSupplement.baseURL.replace(/^\.\//,'').replace(/\/$/,''),
  'data/author-biography-coverage.manifest.json', 'data/author-biography-review.manifest.json',
  'data/tarajm-author-map.json', 'data/tarajm-biographies.json', 'data/people-facets.json',
  'data/tarajm-persons.manifest.json', 'data/tarajm-persons',
  'data/author-persons.release.json', `data/author-persons/${authorPersonRelease.generation}`,
] as const

/**
 * `publicDir` معطل عمدًا حتى لا ينسخ corpus المكتبة الضخم. لكن shell المبني
 * يجب أن يبقى مكتفيًا ذاتيًا: ننسخ فقط الهوية والخطوط وملفات PWA الخفيفة.
 */
function emitEssentialPublicAssets(): Plugin {
  return {
    name: 'emit-essential-public-assets',
    configureServer(server) { server.middlewares.use('/data/home-library-statistics.json', async (_req,res,next)=>{try {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await homeLibraryStatistics(__dirname)))}catch {next()}}) },
    async buildStart() { await checkCatalogSnapshot(resolve(__dirname, '..')); await checkHeadingCatalogCoverage(resolve(__dirname,'..')) },
    async writeBundle(options) {
      const outputRoot = typeof options.dir === 'string' ? resolve(options.dir) : resolve(__dirname, 'dist')
      const publicRoot = resolve(__dirname, 'public')
      const isolatedAssets = process.env.KHIZANA_BUILD_READONLY_SOURCE === '1'
      if (!isolatedAssets) await buildTarajmPersonAssets(publicRoot)
      for (const relative of ESSENTIAL_PUBLIC_ASSETS) {
        if (isolatedAssets && (relative === 'data/tarajm-persons' || relative === 'data/tarajm-persons.manifest.json')) continue
        const source = resolve(publicRoot, relative)
        const destination = resolve(outputRoot, relative)
        await mkdir(dirname(destination), { recursive: true })
        if ((await stat(source)).isDirectory()) await cp(source, destination, { recursive: true, force: true, filter: path=>!uiFontAssets.originalPaths.has('/'+path.slice(publicRoot.length+1).replaceAll('\\','/'))&&copySourceEditionAsset(path,sourceEditionPacks) })
        else await copyFile(source, destination)
      }
      if (isolatedAssets) await buildTarajmPersonAssets(outputRoot)
      await stageOptionalHeadingRelease(publicRoot,outputRoot)
      await stageShamelaBiographies(publicRoot,outputRoot)
      await writeFile(resolve(outputRoot,'data/home-library-statistics.json'),JSON.stringify(await homeLibraryStatistics(__dirname)))
      const swPath = resolve(outputRoot, 'sw.js')
      const swSource = await readFile(swPath, 'utf8')
      if (!swSource.includes('const FONT_ALIASES = {}')) throw new Error('font_alias_injection_marker_missing')
      await writeFile(swPath, swSource.replace('const FONT_ALIASES = {}', 'const FONT_ALIASES = '+JSON.stringify(Object.fromEntries([...uiFontAssets.originalPaths].map(([original,target])=>[original,'/'+target])))))
    },
  }
}

function isWithin(root: string, candidate: string): boolean {
  const normalizedRoot = `${resolve(root)}\\`
  return resolve(candidate).startsWith(normalizedRoot)
}

/**
 * التطوير المحلي فقط: يخدم كتب الدفعات التي اعتمدها checkpoint مباشرة من
 * بيانات المشروع، فلا نضاعف corpus داخل public ولا تدخل هذه المسارات في البناء.
 */
export function serveLocalShamelaBatches(): Plugin {
  const handler = async (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
    next: () => void,
  ): Promise<void> => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
        if (!pathname.startsWith('/library/shamela/batches/')) return next()
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.statusCode = 405
          res.setHeader('Allow', 'GET, HEAD')
          res.end('method not allowed')
          return
        }
        // بيانات manifests خفيفة ومتحقق منها وتوجد في public؛ ندع Vite يخدمها.
        if (/^\/library\/shamela\/batches\/batch-\d{4}\/manifest\.json$/u.test(pathname)) return next()
        const match = pathname.match(/^\/library\/shamela\/batches\/(batch-\d{4})\/(books\/\d+\.json)$/u)
        if (!match) {
          res.statusCode = 404
          res.end('not found')
          return
        }
        try {
          const checkpoint = JSON.parse(await readFile(SHAMELA_CHECKPOINT, 'utf8')) as {
            completed?: Array<{ index: number; output: string }>
          }
          const batchName = match[1]
          const approved = checkpoint.completed?.some(item =>
            `batch-${String(item.index).padStart(4, '0')}` === batchName
            && item.output.replace(/\\/g, '/').endsWith(`/published-corpus-v1/${batchName}`))
          if (!approved) {
            res.statusCode = 404
            res.end('not found')
            return
          }
          const batchRoot = resolve(SHAMELA_CORPUS_ROOT, batchName)
          const candidate = resolve(batchRoot, match[2])
          if (!isWithin(batchRoot, candidate)) throw new Error('shamela_dev_path_outside_batch')
          const [realBatchRoot, realCandidate, fileStat] = await Promise.all([
            realpath(batchRoot), realpath(candidate), stat(candidate),
          ])
          if (!isWithin(realBatchRoot, realCandidate) || !(await lstat(candidate)).isFile() || !fileStat.isFile()) throw new Error('shamela_dev_file_invalid')
          const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/u)
          let start = 0
          let end = fileStat.size - 1
          if (range) {
            start = range[1] ? Number(range[1]) : 0
            end = range[2] ? Number(range[2]) : end
            if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= fileStat.size) {
              res.statusCode = 416
              res.setHeader('Content-Range', `bytes */${fileStat.size}`)
              res.end()
              return
            }
            res.statusCode = 206
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileStat.size}`)
          } else res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Accept-Ranges', 'bytes')
          res.setHeader('Content-Length', String(end - start + 1))
          res.setHeader('Cache-Control', 'no-cache')
          if (req.method === 'HEAD') { res.end(); return }
          createReadStream(realCandidate, { start, end }).pipe(res)
        } catch {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('not found')
        }
  }
  return {
    name: 'serve-local-shamela-batches',
    configureServer(server) { server.middlewares.use(handler) },
    configurePreviewServer(server) { server.middlewares.use(handler) },
  }
}

/**
 * dev-only: `harfbuzzjs` self-loads `harfbuzz.wasm` via `new URL(..., import.meta.url)`
 * (Emscripten findWasmBinary). In dev the request lands on `/node_modules/...`, which the
 * SPA fallback answers with index.html ("expected magic word" at instantiate). Serve the
 * real wasm with the correct MIME before the fallback runs. Build path needs no fix
 * (Vite bundles the asset).
 */
function serveHarfbuzzWasm(): Plugin {
  return {
    name: 'serve-harfbuzz-wasm',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        const match = url.match(/^\/node_modules\/harfbuzzjs\/dist\/([^/]+\.wasm)$/)
        if (!match) return next()
        try {
          const bytes = await readFile(resolve(__dirname, `../node_modules/harfbuzzjs/dist/${match[1]}`))
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/wasm')
          res.setHeader('Content-Length', String(bytes.length))
          res.end(bytes)
        } catch {
          res.statusCode = 404
          res.end('not found')
        }
      })
    },
  }
}

/**
 * `public` contains the complete local library corpus. Letting Vite's generic
 * public middleware discover that tree before answering a request can block a
 * cold local session for minutes. Serve requested public files directly and on
 * demand instead; Vite must never enumerate the complete local corpus merely to
 * answer `/`, a source module, or one Quran pack.
 */
export function serveReaderPublicAssets(): Plugin {
  const publicRoot = resolve(__dirname, 'public')
  const contentType = (pathname: string): string => {
    if (pathname.endsWith('.json')) return 'application/json; charset=utf-8'
    if (pathname.endsWith('.md')) return 'text/markdown; charset=utf-8'
    if (pathname.endsWith('.gz')) return 'application/gzip'
    if (pathname.endsWith('.pdf')) return 'application/pdf'
    if (pathname.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    if (pathname.endsWith('.ttf')) return 'font/ttf'
    if (pathname.endsWith('.otf')) return 'font/otf'
    if (pathname.endsWith('.woff')) return 'font/woff'
    if (pathname.endsWith('.woff2')) return 'font/woff2'
    if (pathname.endsWith('.png')) return 'image/png'
    if (pathname.endsWith('.svg')) return 'image/svg+xml; charset=utf-8'
    if (pathname.endsWith('.webp')) return 'image/webp'
    if (pathname.endsWith('.js')) return 'text/javascript; charset=utf-8'
    if (pathname.endsWith('.css')) return 'text/css; charset=utf-8'
    return 'application/octet-stream'
  }
  const install = (middlewares: { use: (handler: (req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse, next: () => void) => void) => void }): void => {
      middlewares.use(async (req, res, next) => {
        const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        // Source modules and the SPA shell belong to Vite. Probing `public/`
        // for those requests can block Windows on this multi-GB directory
        // before Vite gets a chance to answer even `/` or `/src/...`.
        if (pathname === '/' || pathname.startsWith('/src/') || pathname.startsWith('/@') || pathname.startsWith('/node_modules/')) return next()
        try {
          const candidate = resolve(publicRoot, `.${pathname}`)
          if (!isWithin(publicRoot, candidate)) throw new Error('public_asset_path_outside_root')
          // `realpath(publicRoot)` is unexpectedly expensive on the multi-GB
          // Windows corpus. The lexical containment check above plus rejecting
          // symlinks keeps traversal closed without resolving the whole tree.
          const [fileStat, linkStat] = await Promise.all([stat(candidate), lstat(candidate)])
          if (!fileStat.isFile() || linkStat.isSymbolicLink()) throw new Error('public_asset_not_file')
          res.statusCode = 200
          res.setHeader('Content-Type', contentType(pathname))
          res.setHeader('Content-Length', String(fileStat.size))
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('X-Content-Type-Options', 'nosniff')
          if (req.method === 'HEAD') res.end()
          else createReadStream(candidate).pipe(res)
        } catch { next() }
      })
  }
  return {
    name: 'serve-reader-public-assets',
    enforce: 'pre',
    configureServer(server) { install(server.middlewares) },
    configurePreviewServer(server) { install(server.middlewares) },
  }
}

/** يمنع أي عامل خدمة إنتاجي قديم من السيطرة على localhost أثناء التطوير. */
function disableServiceWorkerInDev(): Plugin {
  return {
    name: 'disable-service-worker-in-dev',
    // صفحة التنقل network-first حتى لدى العامل القديم. تغيير عنوان نقطة الدخول
    // يجبره على جلب وحدات Vite الحديثة بدل نسخة cache-first عالقة.
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) { return context.server ? html.replace('/src/main.ts', '/src/main.ts?dev-clean=20260812') : html },
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? '').split('?')[0] !== '/sw.js') return next()
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store, must-revalidate')
        res.end("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil(self.registration.unregister().then(()=>self.clients.matchAll()).then(clients=>clients.forEach(client=>client.navigate(client.url)))));")
      })
    },
  }
}

/**
 * التطوير/المعاينة المحلية لا تشغّلان Cloudflare Pages Functions، لذلك كان
 * `/api/translate` يسقط إلى index.html وتظهر رسالة فشل مضللة. نجسّر الطلب إلى
 * وظيفة الخِزانة المنشورة نفسها؛ لا مفاتيح في المتصفح ولا endpoint غير رسمي.
 */
function localTranslationBridge(): Plugin {
  const install = (middlewares: { use: (fn: (req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse, next: () => void) => void) => void }): void => {
    middlewares.use(async (req, res, next) => {
      if ((req.url ?? '').split('?')[0] !== '/api/translate') return next()
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('Allow', 'POST')
        res.end('POST only')
        return
      }
      try {
        const body = await readRequest(req)
        const upstream = await fetch('https://khezana.pages.dev/api/translate', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body,
          signal: AbortSignal.timeout(25_000),
        })
        const payload = Buffer.from(await upstream.arrayBuffer())
        res.statusCode = upstream.status
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'private, no-store')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Content-Length', String(payload.length))
        res.end(payload)
      } catch {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'تعذّر اتصال النسخة المحلية بخدمة الترجمة الآن.' }))
      }
    })
  }
  return {
    name: 'local-translation-bridge',
    configureServer(server) { install(server.middlewares) },
    configurePreviewServer(server) { install(server.middlewares) },
  }
}

const MAX_DOCX_BYTES = 150 * 1024 * 1024

function readRequest(req: import('node:http').IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_DOCX_BYTES) {
        reject(new Error('حجم ملف Word يتجاوز 150MB'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function runWordConversion(input: string, output: string, pageMap: string): Promise<void> {
  const script = resolve(__dirname, '../tools/convert-docx-to-pdf.ps1')
  return new Promise((resolveRun, reject) => {
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', script, '-InputPath', input, '-OutputPath', output, '-PageMapPath', pageMap,
    ], { windowsHide: true, timeout: 5 * 60_000 }, (error, _stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message))
      else resolveRun()
    })
  })
}

// Word COM ليس خدمة متوازية آمنة: تحويل دفعة كتب معًا كان يترك عشرات عمليات
// WINWORD ويعرّض الخطوط/التصدير للتنافس. كل طلب PDF يدخل طابورًا محليًا واحدًا.
let wordConversionTail: Promise<void> = Promise.resolve()
function enqueueWordConversion(input: string, output: string, pageMap: string): Promise<void> {
  const run = () => runWordConversion(input, output, pageMap)
  const queued = wordConversionTail.then(run, run)
  wordConversionTail = queued.catch(() => undefined)
  return queued
}

function runDocxNormalization(input: string, output: string): Promise<void> {
  const script = resolve(__dirname, '../tools/convert-word-to-docx.ps1')
  return new Promise((resolveRun, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-InputPath', input, '-OutputPath', output],
      { windowsHide: true, timeout: 5 * 60_000 }, (error, _stdout, stderr) => error ? reject(new Error(stderr.trim() || error.message)) : resolveRun())
  })
}

interface WordBokPayload {
  title: string
  author: string
  pages: string[]
  toc: Array<{ id: number; title: string; level: number; parent: number }>
}

function runBokProcess(executable: string, args: string[], timeout = 5 * 60_000): Promise<void> {
  return new Promise((resolveRun, reject) => {
    execFile(executable, args, { windowsHide: true, timeout }, (error, _stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message))
      else resolveRun()
    })
  })
}

function validWordBokPayload(value: unknown): value is WordBokPayload {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<WordBokPayload>
  return typeof item.title === 'string' && typeof item.author === 'string'
    && Array.isArray(item.pages) && item.pages.length > 0 && item.pages.every(page => typeof page === 'string')
    && Array.isArray(item.toc) && item.toc.every(entry => entry && Number.isInteger(entry.id)
      && typeof entry.title === 'string' && Number.isInteger(entry.level) && Number.isInteger(entry.parent))
}

/** خدمة محلية: صفحات Word المفصولة + شجرة عناوينه ← BOK متوافق مع الخزانة. */
function wordBokConversion(): Plugin {
  const install = (middlewares: { use: (fn: (req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse, next: () => void) => void) => void }): void => {
    middlewares.use(async (req, res, next) => {
      if ((req.url ?? '').split('?')[0] !== '/api/convert/word-to-bok') return next()
      if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
      const dir = resolve(tmpdir(), `khizana-bok-${randomUUID()}`)
      try {
        const payload = JSON.parse((await readRequest(req)).toString('utf8')) as unknown
        if (!validWordBokPayload(payload)) throw new Error('بيانات تحويل BOK غير صالحة')
        if (payload.pages.length > 1_000_000) throw new Error('عدد صفحات الكتاب غير صالح')
        await mkdir(dir, { recursive: true })
        const input = resolve(dir, 'source.doc')
        const output = resolve(dir, 'book.bok')
        const metadata = resolve(dir, 'metadata.json')
        await writeFile(input, payload.pages.join('\nPAGE_SEPARATOR\n'), 'utf8')
        await writeFile(metadata, JSON.stringify({ author: payload.author || 'غير معروف', toc: payload.toc }), 'utf8')
        await runBokProcess(resolve(__dirname, '../tools/ShamelaBokConverter.exe'), [input, output, payload.title])
        await runBokProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', resolve(__dirname, '../tools/finalize-bok.ps1'), '-BokPath', output, '-MetadataPath', metadata])
        const bok = await readFile(output)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/x-shamela-bok')
        res.setHeader('Content-Disposition', 'attachment; filename="book.bok"')
        res.setHeader('Content-Length', String(bok.length))
        res.setHeader('Cache-Control', 'no-store')
        res.end(bok)
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
      } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => {})
      }
    })
  }
  return { name: 'word-bok-conversion', configureServer(server) { install(server.middlewares) }, configurePreviewServer(server) { install(server.middlewares) } }
}

/** خدمة محلية: DOCX خام في الطلب ← PDF صادر من Microsoft Word نفسه. */
function wordPdfConversion(): Plugin {
  const install = (middlewares: { use: (fn: (req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse, next: () => void) => void) => void }): void => {
    middlewares.use(async (req, res, next) => {
      const path = (req.url ?? '').split('?')[0]
      const isPdf = path === '/api/convert/docx-to-pdf'
      const isNormalize = path === '/api/convert/word-to-docx'
      if (!isPdf && !isNormalize) return next()
      if (isPdf) res.setHeader('X-Khizana-Word-Pdf-Capability', 'available')
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end('POST only')
        return
      }
      const dir = resolve(tmpdir(), `khizana-word-${randomUUID()}`)
      const extension = isNormalize ? new URL(req.url ?? '', 'http://localhost').searchParams.get('ext') : 'docx'
      if (isNormalize && extension !== 'doc' && extension !== 'rtf') {
        res.statusCode = 400; res.end('امتداد Word القديم غير مدعوم'); return
      }
      const input = resolve(dir, `source.${extension}`)
      const output = resolve(dir, 'source.pdf')
      const normalized = resolve(dir, 'source.docx')
      const pageMap = resolve(dir, 'page-map.json')
      try {
        const bytes = await readRequest(req)
        if (isPdf && (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b)) {
          throw new Error('الملف المرسل ليس DOCX صالحًا')
        }
        await mkdir(dir, { recursive: true })
        await writeFile(input, bytes)
        if (isNormalize) {
          await runDocxNormalization(input, normalized)
          const docx = await readFile(normalized)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
          res.setHeader('Content-Length', String(docx.length))
          res.setHeader('Cache-Control', 'no-store')
          res.end(docx)
          return
        }
        await enqueueWordConversion(input, output, pageMap)
        const pdf = await readFile(output)
        const pageMapJson = await readFile(pageMap, 'utf8')
        const multipart = req.headers.accept?.includes('multipart/form-data')
          ? wordConversionMultipart(pdf, pageMapJson) : undefined
        const legacyMap = multipart ? undefined : Buffer.from(pageMapJson, 'utf8').toString('base64url')
        if (legacyMap && legacyMap.length > 8_000) {
          res.statusCode = 409
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify({ error: 'حدّث واجهة الخزانة لاستقبال خريطة هذا الكتاب الكبيرة بأمان.' }))
          return
        }
        res.statusCode = 200
        res.setHeader('Content-Type', multipart?.contentType ?? 'application/pdf')
        res.setHeader('Content-Length', String(multipart?.body.length ?? pdf.length))
        res.setHeader('Cache-Control', 'no-store')
        if (legacyMap) res.setHeader('X-Word-Page-Map', legacyMap)
        res.setHeader('X-PDF-Engine', 'microsoft-word-com-visual-v3')
        res.setHeader('Access-Control-Expose-Headers', 'X-Word-Page-Map, X-PDF-Engine')
        res.end(multipart?.body ?? pdf)
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
      } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => {})
      }
    })
  }
  return {
    name: 'word-pdf-conversion',
    configureServer(server) { install(server.middlewares) },
    configurePreviewServer(server) { install(server.middlewares) },
  }
}

export default defineConfig(({mode}) => {
 const satelliteConfig=satelliteBuildConfiguration(loadEnv(mode,__dirname,'VITE_MAPTILER_'))
 const satellitePlugin:Plugin={name:'satellite-public-config',transformIndexHtml(html){const marker=satelliteBuildMarker(satelliteConfig);return marker?html.replace('</head>',`${marker}\n</head>`):html}}
  // Vitest runs in Node and its contract tests intentionally inspect files from
  // disk. Browser-only Node stubs must not shadow the real built-ins there.
  const browserNodeAliases = process.env.VITEST
    ? {}
    : {
        'node:fs': resolve(__dirname, 'src/farahidi_browser_node_stubs.ts'),
        'node:url': resolve(__dirname, 'src/farahidi_browser_node_stubs.ts'),
        'node:zlib': resolve(__dirname, 'src/farahidi_browser_node_stubs.ts'),
        'fs': resolve(__dirname, 'src/farahidi_browser_node_stubs.ts'),
        'url': resolve(__dirname, 'src/farahidi_browser_node_stubs.ts'),
        'zlib': resolve(__dirname, 'src/farahidi_browser_node_stubs.ts'),
      }
  return ({
  // The config is commonly launched from the repository root (`vite --config
  // app/vite.config.ts`). Without an explicit root Vite looks for index.html
  // and `/src/*` in that multi-GB repository root. On Windows this can leave
  // every HTTP request pending even though the listener already printed
  // "ready". Keep request resolution anchored to the actual application.
  root: __dirname,
  define:{__SATELLITE_SITE_CONFIG__:JSON.stringify(satelliteConfig)},
  // The repository's public tree is the full offline library (many GB/files).
  // Our pre-middleware above serves individual files without a startup crawl.
  publicDir: false,
  base: '/',
  plugins: [initialScreenCssPlugin(), uiFontAssets, routePreloadHints(), satellitePlugin, serveReaderPublicAssets(), disableServiceWorkerInDev(), emitEssentialPublicAssets(), serveHarfbuzzWasm(), serveLocalShamelaBatches(), localTranslationBridge(), wordPdfConversion(), wordBokConversion()],
  optimizeDeps: {
    // The application owns a very large local corpus and many lazy reader routes.
    // Vite's automatic dependency discovery walks that whole graph on a cold
    // session and can monopolise the dev server long after it starts listening;
    // even static Quran/manifest requests then receive no response. Dependencies
    // are still transformed on demand, while startup remains responsive.
    noDiscovery: true,
    // `fast-xml-parser` is CommonJS. It is pinned below to the repository's v4
    // entry and pre-bundled once, so browser modules get stable named exports
    // without ever resolving an app-local legacy junction.
    // `browserify-aes/browser.js` is CommonJS. MDBReader reaches it through
    // the crypto-browserify chain and expects a synthetic default export; with
    // discovery disabled Vite otherwise serves the raw CJS entry to the browser.
    include: ['fast-xml-parser', 'browserify-aes/browser.js', 'create-hash', 'buffer'],
    // keep harfbuzzjs un-bundled so `new URL("harfbuzz.wasm", import.meta.url)`
    // resolves against the real dist dir (pre-bundling would point it at
    // /node_modules/.vite/deps/ which the SPA fallback answers with index.html)
    // pdfjs يُحمّل عند الحاجة في الاستيراد والقارئ. إبقاؤه خارج optimizeDeps
    // يمنع روابط /node_modules/.vite/deps ذات البصمة المؤقتة من التعفن بعد
    // إعادة تحسين التبعيات في جلسة محلية طويلة.
    exclude: ['harfbuzzjs', 'pdfjs-dist'],
  },
  // Keep the extra reader worker within the Pages file budget by sharing tiny
  // tiny utilities; no corpus asset or feature is removed.
  build: {rollupOptions:{output:{onlyExplicitManualChunks:true,manualChunks(id){
    if(/\/src\/(artifact_download|hash_query_state|recommendation_preferences)\.ts$/.test(id.replaceAll('\\','/')))return 'reader-shared-utils'
  }}}},
  css: {postcss:{plugins:[interfaceFontScale()]}},
  server: {
    port: 5173,
    open: false,
    // `app/public` is the complete offline corpus (millions of files/entries).
    // On Windows, even an ignored watcher still enumerates that tree after the
    // server announces readiness and starves every HTTP request. The explicit
    // asset middleware above serves files on demand; disabling the watcher is
    // therefore the only reliable local contract. Restart Vite after code edits.
    watch: null,
  },
  resolve: {
    alias: {
      ...browserNodeAliases,
      'fast-xml-parser': resolve(__dirname, '../node_modules/fast-xml-parser/src/fxp.js'),
      // الحزمة تعلن CJS وES؛ على مسار Windows العربي اختار Rollup مدخل CJS
      // وحوّل استيراداته النسبية إلى commonjs-external. نثبت مدخل المتصفح ES.
      'pdf-lib': resolve(__dirname, '../node_modules/pdf-lib/dist/pdf-lib.esm.js'),
      '@engine/ooxml-model': resolve(__dirname, '../packages/ooxml-model/src/index.ts'),
      '@engine/ooxml-dom': resolve(__dirname, '../packages/ooxml-dom/src/index.ts'),
      '@engine/layout': resolve(__dirname, '../packages/layout/src/index.ts'),
      '@engine/shaper': resolve(__dirname, '../packages/shaper/src/index.ts'),
      '@engine/bidi': resolve(__dirname, '../packages/bidi/src/index.ts'),
      '@engine/font-system': resolve(__dirname, '../packages/font-system/src/index.ts'),
      '@engine/scene': resolve(__dirname, '../packages/scene/src/index.ts'),
      '@engine/paint': resolve(__dirname, '../packages/paint/src/index.ts'),
      '@engine/interact': resolve(__dirname, '../packages/interact/src/index.ts'),
      '@library/word-cover': resolve(__dirname, '../packages/word-cover/src/index.ts'),
      '@library/source-sync': resolve(__dirname, '../packages/source-sync/src/index.ts'),
    },
  },
  })
})

import { defineConfig, type Plugin } from 'vite'
import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'

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
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Length', String(pdf.length))
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('X-Word-Page-Map', Buffer.from(pageMapJson, 'utf8').toString('base64url'))
        res.setHeader('X-PDF-Engine', 'microsoft-word-com-visual-v3')
        res.setHeader('Access-Control-Expose-Headers', 'X-Word-Page-Map, X-PDF-Engine')
        res.end(pdf)
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

export default defineConfig({
  base: './',
  plugins: [serveHarfbuzzWasm(), wordPdfConversion()],
  optimizeDeps: {
    // keep harfbuzzjs un-bundled so `new URL("harfbuzz.wasm", import.meta.url)`
    // resolves against the real dist dir (pre-bundling would point it at
    // /node_modules/.vite/deps/ which the SPA fallback answers with index.html)
    // pdfjs يُحمّل عند الحاجة في الاستيراد والقارئ. إبقاؤه خارج optimizeDeps
    // يمنع روابط /node_modules/.vite/deps ذات البصمة المؤقتة من التعفن بعد
    // إعادة تحسين التبعيات في جلسة محلية طويلة.
    exclude: ['harfbuzzjs', 'pdfjs-dist'],
  },
  server: {
    port: 5173,
    open: false,
  },
  resolve: {
    alias: {
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

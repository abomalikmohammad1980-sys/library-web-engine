import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const pdfPath = process.env.ALKHIZANA_JBIG2_PDF
  ?? fileURLToPath(new URL('../../../../كتب للاختبار/التشريع الوضعي دراسة عقدية - د. محمد القرني.pdf', import.meta.url))
const wasmPath = new URL('../public/pdfjs/wasm/', import.meta.url)

describe.skipIf(!existsSync(pdfPath))('PDF JBIG2 real corpus', () => {
  it('renders JBIG2 image pages while preserving the intentionally blank source page', async () => {
    const canvasModule = await import('@napi-rs/canvas')
    Object.assign(globalThis, { DOMMatrix: canvasModule.DOMMatrix, ImageData: canvasModule.ImageData, Path2D: canvasModule.Path2D })
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    expect(existsSync(fileURLToPath(new URL('jbig2.wasm', wasmPath)))).toBe(true)
    expect(existsSync(fileURLToPath(new URL('jbig2_nowasm_fallback.js', wasmPath)))).toBe(true)
    // Node cannot import the HTTP fallback module used by pdf.js; exercise the
    // bundled decoder here. Browser QA separately exercises wasmUrl over HTTP.
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(readFileSync(pdfPath)), disableWorker: true, useWasm: false, wasmUrl: pathToFileURL(fileURLToPath(wasmPath)).href })
    const document = await loadingTask.promise
    expect(document.numPages).toBe(409)
    for (const pageNumber of [1, 6, 8, 9]) {
      const page = await document.getPage(pageNumber)
      const viewport = page.getViewport({ scale: .2 })
      const canvas = canvasModule.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      const context = canvas.getContext('2d')
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: context as unknown as CanvasRenderingContext2D, viewport }).promise
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      let ink = 0
      for (let index = 0; index < pixels.length; index += 4) if (pixels[index]! < 248 || pixels[index + 1]! < 248 || pixels[index + 2]! < 248) ink++
      // The source pages have a small PDF user-space box; at scale .2 the
      // expected canvas is about 62px wide. Pixel coverage, not an arbitrary
      // 100px threshold, is the fidelity assertion that catches blank JBIG2.
      expect(canvas.width).toBeGreaterThan(50)
      expect(canvas.height).toBeGreaterThan(70)
      const coverage = ink / (pixels.length / 4)
      if (pageNumber === 9) expect(coverage, 'page 9 is blank in the source PDF').toBeLessThan(.001)
      else expect(coverage, `page ${pageNumber}`).toBeGreaterThan(.005)
    }
    await loadingTask.destroy()
  }, 60_000)
})

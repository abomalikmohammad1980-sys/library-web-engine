import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import viteConfig from '../vite.config'

const importer = readFileSync(new URL('./pdf_import.ts', import.meta.url), 'utf8')

describe('PDF.js development-module stability', () => {
  it('keeps PDF.js out of Vite optimized dependency URLs', async () => {
    const config=typeof viteConfig==='function'?await viteConfig({mode:'development',command:'serve',isPreview:false,isSsrBuild:false}):viteConfig
    expect(config.optimizeDeps?.exclude).toContain('pdfjs-dist')
    expect(importer).toContain("await import('pdfjs-dist')")
    expect(importer).toContain("await import('pdfjs-dist/build/pdf.worker.min.mjs?url')")
    expect(importer).not.toContain('/node_modules/.vite/deps/')
  })
})

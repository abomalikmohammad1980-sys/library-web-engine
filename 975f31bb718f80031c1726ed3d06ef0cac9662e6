export interface PdfJsLocalAssets {
  wasmUrl: string
  cMapUrl: string
  cMapPacked: true
  standardFontDataUrl: string
}

/** أصول PDF.js محلية بالكامل؛ document.baseURI يحترم / و/khizana/ في البناء. */
export function pdfJsLocalAssets(baseUri = document.baseURI): PdfJsLocalAssets {
  const base = new URL('./pdfjs/', baseUri)
  return {
    wasmUrl: new URL('wasm/', base).href,
    cMapUrl: new URL('cmaps/', base).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('standard_fonts/', base).href,
  }
}

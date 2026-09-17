/** ‏@engine/ooxml-dom — يحوّل DocumentModelV0 إلى DOM/CSS مباشرةً
 *  (خليفة `lib/wordToHTML` + `lib/WordToWidget` من المحرك Dart):
 *  لا محاكاةُ هندسةٍ على الشاشة — يُفوَّض الالتفاف والترقيد البصري للمتصفح. */

export { el, css, px, isDomAvailable, setDocumentFactory } from "./dom.js";
export { twipsToPx, ptToPx, fmt, HIGHLIGHT_COLORS, ARABIC_FALLBACK, TWIPS_PER_PX } from "./units.js";
export { cssFamily, registerEmbeddedFonts, extractFontFamily } from "./fonts.js";
export { runCss, runToNode } from "./runT.js";
export { paragraphCss } from "./PPr.js";
export { formatNumber, NumberingState } from "./abstractNum.js";
export {
  ImageCache, newImageCache, resolveImageBytes, imageUrl, rasterPayload,
  anchorToElement, inlineAnchors,
  shapeFrameCss,
} from "./ImageToWidget.js";
export { newRenderCtx, paragraphToElement, tocRowElement, hasPositionalTabs, ptabParagraphElement } from "./Paragraph.js";
export type { RenderCtx } from "./Paragraph.js";
export { renderPageBlocks, renderTable } from "./ParagraphTable.js";
export { pageCss, headerFooterElement, headerFooterPartName, headerFooterType, partNameFromRid } from "./SectPr.js";
export { wordBorderStyle, wordBorderData } from "./BorderCss.js";
export { groupPages, sectionOf, notePositionForPage, buildPageElement, renderDocument, takeRenderedAssetCleanup, footnotesBlock } from "./render.js";

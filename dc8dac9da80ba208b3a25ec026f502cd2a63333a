/**
 * وحدات القياس والتحويل (رسم): شبكة twips ⟵ px.
 *
 * القاعدة (ADR-0004): ‏twip = 1/20 نقطة؛ ‏px@96dpi = 3/4 نقطة = 15 twips.
 * فلا يوجد float في التخطيط — التحويلُ يقع هنا فقط عند الرسم.
 */
export const TWIPS_PER_PX = 15;
export const PX_PER_TWIP = 1 / TWIPS_PER_PX;
export const TWIPS_PER_PT = 20;
export const PT_PER_TWIP = 1 / TWIPS_PER_PT;

/** ‏twips ⟵ px (96dpi) */
export function twipsToPx(twips: number): number {
  return twips / TWIPS_PER_PX;
}

/** ‏px ⟵ twips (96dpi) */
export function pxToTwips(px: number): number {
  return px * TWIPS_PER_PX;
}

/** أبعاد صفحةٍ بالنقاط (لـPDF/الطباعة) */
export function pagePoints(pageWTwips: number, pageHTwips: number): { w: number; h: number } {
  return { w: pageWTwips / TWIPS_PER_PT, h: pageHTwips / TWIPS_PER_PT };
}

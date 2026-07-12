/**
 * وحدات القياس الداخلية للمحرك — ADR-0004.
 *
 * القاعدة الصارمة (AGENTS.md §القواعد 2): كل حسابات التخطيط النصي تجري على
 * أعداد صحيحة من الـ twips (1/20 نقطة) كما يفعل Word، وحسابات الأشكال على
 * EMU. لا يظهر float إلا عند التحجيم النهائي للرسم (`twipsToCssPx`).
 *
 * الثوابت من مواصفة OOXML (ECMA-376):
 *   1pt  = 20 twips
 *   1in  = 72pt = 1440 twips = 914400 EMU
 *   1twip = 635 EMU
 */

/** نوع اسمي (branded) يمنع خلط twips بأرقام عادية في توقيعات الدوال. */
export type Twips = number & { readonly __brand: "twips" };
export type Emu = number & { readonly __brand: "emu" };

export const TWIPS_PER_POINT = 20;
export const TWIPS_PER_INCH = 1440;
export const EMU_PER_INCH = 914400;
export const EMU_PER_TWIP = 635;
/** بكسل CSS المرجعي = 1/96 بوصة ⇐ 15 twips بالضبط. */
export const TWIPS_PER_CSS_PX = 15;

export function twips(n: number): Twips {
  if (!Number.isInteger(n)) {
    throw new RangeError(`Twips يجب أن تكون عددًا صحيحًا، وصل: ${n}`);
  }
  return n as Twips;
}

export function emu(n: number): Emu {
  if (!Number.isInteger(n)) {
    throw new RangeError(`EMU يجب أن تكون عددًا صحيحًا، وصل: ${n}`);
  }
  return n as Emu;
}

/** نقاط ← twips. القيم في OOXML كثيرًا ما تأتي بأنصاف النقاط — انظر halfPointsToTwips. */
export function pointsToTwips(pt: number): Twips {
  return twips(Math.round(pt * TWIPS_PER_POINT));
}

/** أنصاف النقاط (صيغة `w:sz` لحجم الخط) ← twips. */
export function halfPointsToTwips(halfPt: number): Twips {
  return twips(Math.round(halfPt * (TWIPS_PER_POINT / 2)));
}

export function twipsToPoints(t: Twips): number {
  return t / TWIPS_PER_POINT;
}

/** ‏EMU (إحداثيات DrawingML) ← twips، بتقريب Word (أقرب صحيح). */
export function emuToTwips(e: Emu): Twips {
  return twips(Math.round(e / EMU_PER_TWIP));
}

export function twipsToEmu(t: Twips): Emu {
  return emu(t * EMU_PER_TWIP);
}

/**
 * التحجيم النهائي للرسم فقط — المكان الوحيد المسموح فيه بالخروج من الشبكة
 * الصحيحة إلى float (بكسل CSS عند مقياس زوم معيّن).
 */
export function twipsToCssPx(t: Twips, zoom = 1): number {
  return (t / TWIPS_PER_CSS_PX) * zoom;
}

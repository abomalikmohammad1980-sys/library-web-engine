/** وحدات القياس — ‏twips ⟵ px بمقياس 96dpi (بكسل = twip ÷ 15). */

/** ‏1 twip = 1/20 نقطة = 1/1440 بوصة؛ عند 96dpi: بكسل/تويب = 96/1440 = 1/15 */
export const TWIPS_PER_PX = 15;

export function twipsToPx(twips: number): number {
  return twips / TWIPS_PER_PX;
}

export function ptToPx(pt: number): number {
  return (pt * 96) / 72;
}

/** يُنسّق رقمًا بلا زخرفة ويقتطع الكسور الزائدة عن 3 خانات. */
export function fmt(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}

/** ألوان التظليل المسماة (w:highlight) — أسماء OOXML الثابتة → RRGGBB */
export const HIGHLIGHT_COLORS: Record<string, string> = {
  black: "#000000",
  blue: "#0000FF",
  cyan: "#00FFFF",
  green: "#00FF00",
  magenta: "#FF00FF",
  red: "#FF0000",
  yellow: "#FFFF00",
  darkBlue: "#00008B",
  darkCyan: "#008B8B",
  darkGreen: "#006400",
  darkMagenta: "#8B008B",
  darkRed: "#8B0000",
  darkYellow: "#808000",
  darkGray: "#A9A9A9",
  lightGray: "#D3D3D3",
};

/** الخطوط العربية المعروفة احتياطًا حين تغيب عائلةٌ مطلوبة أو لم تُحمَّل */
export const ARABIC_FALLBACK = "'Traditional Arabic','Amiri','Lateef','Scheherazade New','Times New Roman',serif";

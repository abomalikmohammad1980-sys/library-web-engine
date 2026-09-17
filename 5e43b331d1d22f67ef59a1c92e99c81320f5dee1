/** ترجمة أسماء حدود Word/OOXML إلى قيم CSS صالحة.
 * تمرير ST_Border حرفيًا يجعل المتصفح يسقط أنماطًا مثل dashSmallGap. */
export type CssBorderStyle = "solid" | "double" | "dashed" | "dotted";

export function wordBorderStyle(val: string | null | undefined): CssBorderStyle {
  const value = (val ?? "single").toLowerCase();
  if (value === "double" || value === "triple" || value === "doublewave"
    || value.includes("thickthin") || value.includes("thinthick")) return "double";
  if (value === "dotted" || value === "dotdash" || value === "dotdotdash") return "dotted";
  if (value === "dashed" || value === "dashsmallgap" || value === "dashdotstroked") return "dashed";
  // الموجات والحدود الفنية تحتاج طبقة رسم لاحقة؛ لا نسقط الإطار في هذه الأثناء.
  return "solid";
}

export function wordBorderData(val: string | null | undefined): string {
  return (val ?? "single").replace(/[^a-zA-Z0-9_-]/g, "");
}

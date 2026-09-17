/**
 * محللُ مسارات SVG — مسارُ الغليف الذي يخرجه HarfBuzz (‏glyphToPath) بصيغة SVG.
 *
 * خالصٌ (بلا DOM) ليُختبر في Node. يدعم مجموعة أوامر SVG الأساسية
 * (M/L/H/V/C/S/Q/T/Z)؛ القوس A يُقرأ ليعرف نهايته دون رسم (لا يُخرجه
 * HarfBuzz عادة). وحداتُ المسار وحداتُ خط (font units) بمقياس upem.
 */

export type PathCmd =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "H"; x: number }
  | { type: "V"; y: number }
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "S"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "Q"; x1: number; y1: number; x: number; y: number }
  | { type: "T"; x1: number; y1: number; x: number; y: number }
  | { type: "A"; rx: number; ry: number; rot: number; large: number; sweep: number; x: number; y: number }
  | { type: "Z" };

const NUM_RE = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/y;

/** يفكّ مسار SVG إلى أوامر؛ يرمي على ما لا يفهمه (يُفشِل الاختبار لا العرض الصامت). */
export function parseSvgPath(d: string): PathCmd[] {
  const cmds: PathCmd[] = [];
  let i = 0;
  let prev: PathCmd | null = null;
  let prevCtl: { x: number; y: number } | null = null; // انعكاس S/T
  const nextNum = (): number | null => {
    NUM_RE.lastIndex = i;
    const m = NUM_RE.exec(d);
    if (!m) return null;
    i = NUM_RE.lastIndex;
    return Number(m[0]);
  };
  const skipSpace = (): void => {
    while (i < d.length && /\s|,/.test(d[i]!)) i++;
  };
  const expect = (n: number): number[] => {
    const out: number[] = [];
    for (let k = 0; k < n; k++) {
      skipSpace();
      const v = nextNum();
      if (v === null) throw new Error(`مسار SVG ناقص: «${d.slice(0, 80)}» عند ${i}`);
      out.push(v);
    }
    return out;
  };
  // نقطة نهاية آخر أمر (لـZ/الافتراضيّات النسبية)
  let endX = 0, endY = 0;

  while (i < d.length) {
    skipSpace();
    if (i >= d.length) break;
    const ch = d[i]!;
    if (ch === "z" || ch === "Z") { cmds.push({ type: "Z" }); i++; endX = 0; endY = 0; prev = cmds[cmds.length - 1]!; prevCtl = null; continue; }
    if (!/[MmLlHhVvCcSsQqTt]/.test(ch)) throw new Error(`أمر مسار SVG مجهول: «${ch}» في «${d.slice(0, 80)}»`);
    const rel = ch >= "a" && ch <= "z";
    const cmd = ch.toUpperCase();
    i++;
    let n: number;
    let p: number[] = [];
    switch (cmd) {
      case "M": n = 2; p = expect(n); break;
      case "L": n = 2; p = expect(n); break;
      case "H": case "V": n = 1; p = expect(n); break;
      case "C": n = 6; p = expect(n); break;
      case "S": case "Q": n = 4; p = expect(n); break;
      case "T": n = 2; p = expect(n); break;
      default: throw new Error(`أمر مسار SVG غير مدعوم: «${ch}»`);
    }
    const x = rel ? endX : 0, y = rel ? endY : 0;
    const xabs = (v: number, k: number) => (rel ? v + x : v);
    const yabs = (v: number, k: number) => (rel ? v + y : v);
    if (cmd === "M") {
      const c: PathCmd = { type: "M", x: xabs(p[0]!, 0), y: yabs(p[1]!, 1) };
      cmds.push(c); prev = c; endX = c.x; endY = c.y; prevCtl = null;
    } else if (cmd === "L") {
      const c: PathCmd = { type: "L", x: xabs(p[0]!, 0), y: yabs(p[1]!, 1) };
      cmds.push(c); prev = c; endX = c.x; endY = c.y; prevCtl = null;
    } else if (cmd === "H") {
      const c: PathCmd = { type: "H", x: xabs(p[0]!, 0) };
      cmds.push(c); prev = c; endX = c.x; endY = rel ? y : endY; prevCtl = null;
    } else if (cmd === "V") {
      const c: PathCmd = { type: "V", y: yabs(p[0]!, 0) };
      cmds.push(c); prev = c; endY = c.y; endX = rel ? x : endX; prevCtl = null;
    } else if (cmd === "C") {
      const c: PathCmd = { type: "C", x1: xabs(p[0]!, 0), y1: yabs(p[1]!, 1), x2: xabs(p[2]!, 2), y2: yabs(p[3]!, 3), x: xabs(p[4]!, 4), y: yabs(p[5]!, 5) };
      cmds.push(c); prev = c; endX = c.x; endY = c.y; prevCtl = { x: c.x2, y: c.y2 };
    } else if (cmd === "S") {
      const x2 = xabs(p[0]!, 0), y2 = yabs(p[1]!, 1);
      // نقطة التحكم الأولى ضمنية = انعكاس نقطة تحكم آخر أمرٍ سابق عبر النقطة الحالية
      const ctl: { x: number; y: number } =
        prevCtl ? prevCtl : (prev ? { x: endX, y: endY } : { x: x2, y: y2 });
      const x1 = 2 * endX - ctl.x, y1 = 2 * endY - ctl.y;
      const c: PathCmd = { type: "S", x1, y1, x2, y2, x: xabs(p[2]!, 2), y: yabs(p[3]!, 3) };
      cmds.push(c); prev = c; endX = c.x; endY = c.y; prevCtl = { x: c.x2, y: c.y2 };
    } else if (cmd === "Q") {
      const c: PathCmd = { type: "Q", x1: xabs(p[0]!, 0), y1: yabs(p[1]!, 1), x: xabs(p[2]!, 2), y: yabs(p[3]!, 3) };
      cmds.push(c); prev = c; endX = c.x; endY = c.y; prevCtl = { x: c.x1, y: c.y1 };
    } else { // T — نقطة التحكم الوحيدة ضمنية = انعكاس نقطة تحكم آخر أمرٍ سابق
      const ctl: { x: number; y: number } =
        prevCtl ? prevCtl : (prev ? { x: endX, y: endY } : { x: 0, y: 0 });
      const x1 = 2 * endX - ctl.x, y1 = 2 * endY - ctl.y;
      const c: PathCmd = { type: "T", x1, y1, x: xabs(p[0]!, 0), y: yabs(p[1]!, 1) };
      cmds.push(c); prev = c; endX = c.x; endY = c.y; prevCtl = { x: c.x1, y: c.y1 };
    }
  }
  return cmds;
}

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

/** محيط المسار (وحدات الخط) — تقديرٌ تقريبي للأقواس. */
export function pathBoundingBox(cmds: PathCmd[]): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let x = 0, y = 0;
  const touch = (px: number, py: number) => {
    if (px < minX) minX = px; if (py < minY) minY = py;
    if (px > maxX) maxX = px; if (py > maxY) maxY = py;
  };
  for (const c of cmds) {
    switch (c.type) {
      case "M": x = c.x; y = c.y; touch(x, y); break;
      case "L": x = c.x; y = c.y; touch(x, y); break;
      case "H": x = c.x; touch(x, y); break;
      case "V": y = c.y; touch(x, y); break;
      case "C": touch(c.x1, c.y1); touch(c.x2, c.y2); x = c.x; y = c.y; touch(x, y); break;
      case "S": touch(c.x1, c.y1); touch(c.x2, c.y2); x = c.x; y = c.y; touch(x, y); break;
      case "Q": touch(c.x1, c.y1); x = c.x; y = c.y; touch(x, y); break;
      case "T": touch(c.x1, c.y1); x = c.x; y = c.y; touch(x, y); break;
      case "A": x = c.x; y = c.y; touch(x, y); break;
      case "Z": touch(x, y); break;
    }
  }
  return { minX, minY, maxX, maxY };
}

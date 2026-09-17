/** ‏runT — ترجمة EffectiveRun إلى عنصر DOM (span) بتنسيقات RPr الفعالة.
 *  ترجمة مفهومية من `reference/dart-engine/lib/wordToHTML/runT.dart`:
 *  الخط/الحجم/الوزن/الميل/التسطير/الشطب/اللون/التظليل/التباعد/الموضع/الحروف. */

import type { EffectiveRun, MathNode } from "@engine/ooxml-model";
import { css, el, elNS, px } from "./dom.js";
import { twipsToPx, HIGHLIGHT_COLORS } from "./units.js";
import { cssFamily } from "./fonts.js";
import { formatNumber } from "./abstractNum.js";

/** pseudo-element يبقي نسخة الانعكاس خارج textContent والنسخ والبحث. */
export const TEXT_REFLECTION_STYLE = ".run-reflection::before{content:attr(data-reflection-text);background:inherit;background-clip:inherit;-webkit-background-clip:inherit;color:inherit;-webkit-text-stroke:inherit;text-shadow:inherit;font:inherit}";

function ensureTextReflectionStyle(): void {
  if (typeof document === "undefined" || !document.head || typeof document.createElement !== "function") return;
  if (document.head.querySelector?.("style[data-word-text-reflection]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-word-text-reflection", "true");
  style.textContent = TEXT_REFLECTION_STYLE;
  document.head.appendChild(style);
}

/** نمطُ تسطير OOXML ⟵ CSS text-decoration-style */
function underlineStyle(val: string): string {
  switch (val) {
    case "double": return "double";
    case "dotted": return "dotted";
    case "dash": case "dashDot": case "dashDotDot": return "dashed";
    case "wave": case "wavyDouble": case "wavyHeavy": return "wavy";
    case "thick": case "thickDot": return "solid";
    default: return "solid";
  }
}

const MATHML_NS = "http://www.w3.org/1998/Math/MathML";
function mathEl(name: string, children: Node[] = []): Element {
  const node = elNS(MATHML_NS, name);
  for (const child of children) node.appendChild(child);
  return node;
}
function mathText(text: string): Element {
  const tag = /^\s*[+\-−=<>×÷(),;]\s*$/.test(text) ? "mo"
    : /^\s*[\d.,]+\s*$/.test(text) ? "mn" : "mi";
  const node = mathEl(tag); node.textContent = text; return node;
}
/** يرسم البنية الدلالية المستخرجة من OMML بـMathML الأصلي في المتصفح. */
export function mathToNode(math: MathNode): Element {
  switch (math.kind) {
    case "text": return mathText(math.text);
    case "row": return mathEl("mrow", math.children.map(mathToNode));
    case "fraction": return mathEl("mfrac", [mathToNode(math.numerator), mathToNode(math.denominator)]);
    case "sup": return mathEl("msup", [mathToNode(math.base), mathToNode(math.script)]);
    case "sub": return mathEl("msub", [mathToNode(math.base), mathToNode(math.script)]);
    case "subsup": return mathEl("msubsup", [mathToNode(math.base), mathToNode(math.sub), mathToNode(math.sup)]);
    case "radical": return math.degree
      ? mathEl("mroot", [mathToNode(math.radicand), mathToNode(math.degree)])
      : mathEl("msqrt", [mathToNode(math.radicand)]);
    case "delimiter": {
      const open = mathText(math.begin), close = mathText(math.end);
      open.setAttribute("stretchy", "true"); close.setAttribute("stretchy", "true");
      return mathEl("mrow", [open, mathToNode(math.content), close]);
    }
    case "matrix": return mathEl("mtable", math.rows.map(row =>
      mathEl("mtr", row.map(cell => mathEl("mtd", [mathToNode(cell)])))));
    case "nary": {
      const op = mathText(math.operator); op.setAttribute("largeop", "true");
      let scripted: Element = op;
      if (math.sub && math.sup) scripted = mathEl(math.limits ? "munderover" : "msubsup",
        [op, mathToNode(math.sub), mathToNode(math.sup)]);
      else if (math.sub) scripted = mathEl(math.limits ? "munder" : "msub", [op, mathToNode(math.sub)]);
      else if (math.sup) scripted = mathEl(math.limits ? "mover" : "msup", [op, mathToNode(math.sup)]);
      return mathEl("mrow", [scripted, mathToNode(math.base)]);
    }
    case "accent": {
      const mark = mathText(math.char); mark.setAttribute("stretchy", "true");
      mark.setAttribute("accent", "true");
      return mathEl(math.position === "bottom" ? "munder" : "mover", [mathToNode(math.base), mark]);
    }
    case "function": return mathEl("mrow", [mathToNode(math.name), mathToNode(math.argument)]);
    case "limit": return mathEl(math.position === "lower" ? "munder" : "mover",
      [mathToNode(math.base), mathToNode(math.limit)]);
  }
}

/** يبني CSS الرن (بدون النص) — منفصلٌ لسهولة الاختبار. */
export function wordFontKerning(run: EffectiveRun): "normal" | "none" | null {
  if (run.kern == null || run.kern <= 0) return null;
  // w:kern وw:sz كلاهما بأنصاف النقاط؛ emTwips = w:sz × 10.
  if (run.emTwips == null) return "normal";
  return run.emTwips >= run.kern * 10 ? "normal" : "none";
}

export function runCss(run: EffectiveRun): string {
  const items: (string | false)[] = [];
  // لا نعزل الرن العربي داخل فقرة عربية: Word كثيرًا ما يشطر الكلمة الواحدة
  // إلى عدة runs متجاورة، وunicode-bidi:isolate يفصل الحرف عند حد الرن.
  if (run.direction === "ltr") {
    items.push(`direction:${run.direction}`);
    items.push("unicode-bidi:isolate");
  }
  items.push(`font-family:${cssFamily(run.family)}`);
  if (run.emTwips) items.push(`font-size:${px(twipsToPx(run.emTwips))}`);
  if (run.bold) items.push("font-weight:700");
  if (run.italic) items.push("font-style:italic");
  const kerning = wordFontKerning(run);
  if (kerning) items.push(`font-kerning:${kerning}`);
  if (run.charScale != null && run.charScale > 0 && run.charScale !== 100)
    items.push(`font-stretch:${run.charScale}%`);
  if (run.ligatures === "standardContextual")
    items.push("font-variant-ligatures:common-ligatures contextual");
  if (run.textGradient?.stops.length) {
    const stops = run.textGradient.stops
      .map(stop => `#${stop.color} ${Math.round(stop.pos * 100000) / 1000}%`).join(",");
    items.push(`background:linear-gradient(${run.textGradient.angle}deg,${stops})`);
    items.push("background-clip:text");
    items.push("-webkit-background-clip:text");
    items.push("color:transparent");
  }
  if (run.textOutline && run.textOutline.widthTwips > 0) {
    items.push(`-webkit-text-stroke:${px(twipsToPx(run.textOutline.widthTwips))} #${run.textOutline.color}`);
    items.push("paint-order:stroke fill");
  }
  if (run.textShadow) {
    const hex = run.textShadow.color;
    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    items.push(`text-shadow:${px(twipsToPx(run.textShadow.xTwips))} ${px(twipsToPx(run.textShadow.yTwips))} ${px(twipsToPx(run.textShadow.blurTwips))} rgba(${red},${green},${blue},${run.textShadow.opacity})`);
  }

  const deco: string[] = [];
  if (run.underline && run.underline !== "none") {
    deco.push("underline");
    const s = underlineStyle(run.underline);
    if (s !== "solid") items.push(`text-decoration-style:${s}`);
    if (run.underlineColor) items.push(`text-decoration-color:#${run.underlineColor}`);
  }
  if (run.strike || run.doubleStrike) deco.push("line-through");
  if (deco.length) items.push(`text-decoration-line:${deco.join(" ")}`);

  if (run.color) items.push(`color:#${run.color}`);
  if (run.highlight) {
    const h = HIGHLIGHT_COLORS[run.highlight.toLowerCase()];
    if (h) items.push(`background-color:${h}`);
  }
  if (run.caps) items.push("text-transform:uppercase");
  if (run.smallCaps) items.push("font-variant:small-caps");
  if (run.charSpacing) items.push(`letter-spacing:${px(twipsToPx(run.charSpacing))}`);
  if (run.superscript) items.push("vertical-align:super;font-size:0.58em;line-height:0");
  if (run.subscript) items.push("vertical-align:sub;font-size:0.58em;line-height:0");
  if (run.position) {
    // w:position أنصافُ نقاط ⟵ twips ×10؛ موجب = رفع (vertical-align موجب يرفع الأساس)
    items.push(`vertical-align:${px(twipsToPx(run.position * 10))}`);
  }
  return css(items);
}

/** طبقة انعكاس مطلقة؛ لا تشارك في عرض الرن ولا ارتفاع السطر. */
export function textReflectionCss(run: EffectiveRun): string | null {
  const r = run.textReflection;
  if (!r) return null;
  const start = Math.round(r.startPosition * 100000) / 1000;
  const end = Math.round(r.endPosition * 100000) / 1000;
  const startAlpha = Math.round(r.startOpacity * 100000) / 100000;
  const endAlpha = Math.round(r.endOpacity * 100000) / 100000;
  const mask = `linear-gradient(${r.fadeAngle}deg,rgba(0,0,0,${startAlpha}) ${start}%,rgba(0,0,0,${endAlpha}) ${end}%,transparent ${end}%)`;
  return css([runCss(run), "position:absolute", `inset-inline-start:${px(twipsToPx(r.xTwips))}`,
    `top:calc(100% + ${px(twipsToPx(r.yTwips))})`,
    `transform:scale(${r.scaleX},${r.scaleY})`, "transform-origin:top",
    `filter:blur(${px(twipsToPx(r.blurTwips))})`, `mask-image:${mask}`,
    `-webkit-mask-image:${mask}`, "pointer-events:none", "user-select:none",
    "white-space:pre", "z-index:0"]);
}

/** يحوّل الرن إلى Node (span أو a لرابطٍ تشعبي) — أو null للرنّ المخفي.
 *  الحواشي: رقم المرجع يُرفَع ويُربَط بموضع الحاشية. */
export function runToNode(run: EffectiveRun): Node | null {
  if (run.hidden) return null;
  const text = run.fieldResult ?? run.text;
  const cssText = runCss(run);

  const inner: (Node | string)[] = [];
  if (run.math) {
    const math = mathEl("math", [mathToNode(run.math)]);
    math.setAttribute("display", "inline");
    math.setAttribute("aria-label", text);
    inner.push(math);
  } else if (run.noteRef) {
    const noteNumber = run.noteRef.custom
      ? (run.noteRef.customMark ?? text)
      : formatNumber(run.noteRef.fmt === "decimal" && run.direction === "rtl"
        ? "hindiNumbers" : (run.noteRef.fmt ?? "decimal"), run.noteRef.num);
    inner.push(el("span", {
      class: "note-ref",
      // الخط والحجم والرفع/الموضع موروثة من runCss على الأب. لا نضيف رفعًا
      // ثانيًا إلى الرقم وحده فينفصل عن قوسي rStyle المؤلفين معه.
      style: css(["display:inline", "margin:0", "padding:0", "direction:rtl", "unicode-bidi:isolate"]),
      "data-note": run.noteRef.kind === "endnote" ? "endnote" : "footnote",
      "data-note-id": run.noteRef.id ?? "",
    }, noteNumber));
  } else if (text) {
    // Keep logical OOXML text intact. The browser's bidi algorithm mirrors
    // bracket glyphs; swapping code points here mirrors them a second time
    // and corrupts copied text, including braces split across Word runs.
    inner.push(text);
  }

  if (inner.length === 0) return null;
  const language = run.direction === "rtl"
    ? (run.bidiLanguage ?? run.language ?? run.eastAsiaLanguage)
    : (run.language ?? run.eastAsiaLanguage ?? run.bidiLanguage);
  const reflectionStyle = text && !run.math && !run.noteRef ? textReflectionCss(run) : null;
  if (reflectionStyle) {
    ensureTextReflectionStyle();
    inner.push(el("span", {
      class: "run-reflection", style: reflectionStyle, "aria-hidden": "true",
      "data-reflection-text": text,
    }));
  }
  const span = el("span", { class: "run", style: css([cssText,
    reflectionStyle ? "position:relative" : false]), lang: language }, inner);
  if (run.href) {
    const external = /^[a-z]+:/i.test(run.href);
    const link = el("a", {
      class: "run-link", href: external ? run.href : "#",
      target: /^https?:/i.test(run.href) ? "_blank" : undefined,
      ...(external ? {} : { "data-word-bookmark": run.href }),
    }, span);
    if (!external && typeof link.addEventListener === "function") link.addEventListener("click", (event) => {
      event.preventDefault(); event.stopPropagation();
      const root = link.closest(".doc") ?? document;
      const target = Array.from(root.querySelectorAll<HTMLElement>("[id]"))
        .find(node => node.id === run.href);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      target?.focus({ preventScroll: true });
    });
    return link;
  }
  return span;
}

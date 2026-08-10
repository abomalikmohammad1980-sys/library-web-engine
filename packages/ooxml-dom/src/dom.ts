/** أدوات DOM خفيفة — إنشاء عناصر وتركيب CSS من مقاطع. */

let doc: () => Document = () => globalThis.document;

export function isDomAvailable(): boolean {
  return typeof globalThis.document !== "undefined";
}

/** ينشئ عنصرًا بسماتٍ وأبناء (مصفوفات متداخلة تُسطَّح). null/false تُحذف؛
 *  true تُنشئ سمةً فارغة؛ "" تُحذف (القيم الشرطية). */
type Child = Node | string | null | undefined;
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number | boolean | null | undefined>,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const node = doc().createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false || v === "") continue;
      if (v === true) node.setAttribute(k, "");
      else node.setAttribute(k, String(v));
    }
  }
  const flat: Child[] = [];
  const collect = (xs: (Child | Child[])[]): void => {
    for (const c of xs) {
      if (Array.isArray(c)) collect(c);
      else if (c != null) flat.push(c);
    }
  };
  collect(children);
  for (const c of flat) {
    if (typeof c === "string") node.appendChild(doc().createTextNode(c));
    else if (c) node.appendChild(c);
  }
  return node;
}

/** ينشئ عنصرًا في نطاق XML (MathML/SVG) من مصنع DOM نفسه المستعمل في الاختبارات.
 * لا يجوز للمحولات استدعاء globalThis.document مباشرةً، وإلا تعذّر تشغيلها
 * في الاختبارات والخوادم التي تحقن Document بديلًا. */
export function elNS(namespace: string, tag: string): Element {
  return doc().createElementNS(namespace, tag);
}

/** يدمج مقاطع CSS في سلسلة واحدة بفاصلات منقوطة، متجاهلًا القيم الكاذبة. */
export function css(items: (string | false | null | undefined)[]): string {
  return items.filter((x): x is string => !!x).join(";");
}

/** رقم ⟵ px بثلاث خاناتٍ بعد الفاصلة. */
export function px(n: number): string {
  return `${Math.round(n * 1000) / 1000}px`;
}

/** يهيّئ عقدة إنشاء عناصر من مكتبة DOM خارجية (اختبارات). */
export function setDocumentFactory(factory: () => Document): void {
  doc = factory;
}

import { describe, expect, it } from "vitest";
import { setDocumentFactory } from "./dom.js";
import { runToNode } from "./runT.js";

class FakeNode {
  tagName = ""; children: FakeNode[] = []; attrs = new Map<string, string>(); textContent = "";
  appendChild(child: FakeNode): FakeNode { this.children.push(child); return child; }
  setAttribute(key: string, value: string): void { this.attrs.set(key, value); }
  getAttribute(key: string): string | null { return this.attrs.get(key) ?? null; }
  querySelector(tag: string): FakeNode | null {
    if (this.tagName.toLowerCase() === tag.toLowerCase()) return this;
    for (const child of this.children) { const hit = child.querySelector(tag); if (hit) return hit; }
    return null;
  }
  get fullText(): string { return this.textContent + this.children.map(child => child.fullText).join(""); }
}
const fakeDocument = {
  createElement: (tag: string) => Object.assign(new FakeNode(), { tagName: tag }),
  createElementNS: (_ns: string, tag: string) => Object.assign(new FakeNode(), { tagName: tag }),
  createTextNode: (text: string) => Object.assign(new FakeNode(), { textContent: text }),
} as unknown as Document;
setDocumentFactory(() => fakeDocument);

describe("OMML to MathML rendering", () => {
  it("يرسم الكسر والأس داخل math دلالي ولا يعرض النص الخطي البديل", () => {
    const node = runToNode({
      text: "(x)/(y^2)", family: null, emTwips: 240, hidden: false,
      math: { kind: "fraction", numerator: { kind: "text", text: "x" }, denominator: {
        kind: "sup", base: { kind: "text", text: "y" }, script: { kind: "text", text: "2" },
      } },
    }) as HTMLElement;
    expect(node.querySelector("math")).not.toBeNull();
    expect(node.querySelector("mfrac")).not.toBeNull();
    expect((node.querySelector("msup") as unknown as FakeNode)?.fullText).toBe("y2");
    expect(node.querySelector("math")?.getAttribute("aria-label")).toBe("(x)/(y^2)");
  });

  it("يرسم المؤثر الكبير واللهجة والحد بهندسة MathML الموافقة", () => {
    const node = runToNode({
      text: "∑_i=0^nx over(y,̂) lim_x→0", family: null, emTwips: 240, hidden: false,
      math: { kind: "row", children: [
        { kind: "nary", operator: "∑", base: { kind: "text", text: "x" },
          sub: { kind: "text", text: "i=0" }, sup: { kind: "text", text: "n" }, limits: true },
        { kind: "accent", base: { kind: "text", text: "y" }, char: "̂", position: "top" },
        { kind: "limit", base: { kind: "text", text: "lim" }, limit: { kind: "text", text: "x→0" }, position: "lower" },
      ] },
    }) as HTMLElement;
    expect((node.querySelector("munderover") as unknown as FakeNode)?.fullText).toBe("∑i=0n");
    expect(node.querySelector("mover")).not.toBeNull();
    expect(node.querySelector("munder")).not.toBeNull();
    expect(node.querySelector("math")?.getAttribute("aria-label")).toBe("∑_i=0^nx over(y,̂) lim_x→0");
  });
});

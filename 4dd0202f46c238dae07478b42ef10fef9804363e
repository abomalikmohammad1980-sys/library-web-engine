import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractFromDocx } from "@engine/ooxml-model";
import { auditWordPageMap, groupsFromWordPageMap } from "../../../app/src/engine/dom_render.js";
import { setDocumentFactory } from "./dom.js";
import { renderDocument } from "./render.js";

interface PageMap {
  totalPages: number;
  paragraphCount: number;
  pages: Array<{ physicalPage: number; adjustedPage: number; firstParagraphIndex: number; lastParagraphIndex: number }>;
  paragraphs: Array<{ paragraphIndex: number; physicalPage: number; adjustedPage: number }>;
}
interface PublishedWork {
  id: string; title: string;
  sources: Array<{ format: string; path: string }>;
  wordArtifact?: { path: string; totalPages: number; paragraphCount: number };
}

class FakeNode {
  children: FakeNode[] = [];
  attrs = new Map<string, string>();
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  text = "";
  constructor(readonly tag: string) {}
  setAttribute(key: string, value: string): void { this.attrs.set(key, value); }
  appendChild(child: FakeNode): FakeNode { this.children.push(child); return child; }
  get textContent(): string { return this.text || this.children.map(child => child.textContent).join(""); }
}
class FakeDocument {
  createElement(tag: string): FakeNode { return new FakeNode(tag); }
  createElementNS(_namespace: string, tag: string): FakeNode { return new FakeNode(tag); }
  createTextNode(text: string): FakeNode { const node = new FakeNode("#text"); node.text = text; return node; }
}
setDocumentFactory(() => new FakeDocument() as unknown as Document);

const publicRoot = new URL("../../../app/public/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("library/published/manifest.json", publicRoot), "utf8")) as { works: PublishedWork[] };
const wordWorks = manifest.works.filter(work => work.wordArtifact);
const riskSummary: Array<{ title: string; cover: number; images: number; tables: number; notes: number; margins: number; bookmarks: number }> = [];
const descendants = (node: FakeNode): FakeNode[] => [node, ...node.children.flatMap(descendants)];
const normalizedText = (value: string): string => value.replace(/\s+/g, " ").trim();
const finiteCss = (value: string): boolean => !/(?:NaN|Infinity|undefined|null)(?:px|pt|twip|%|;|$)/.test(value);
const validImage = (bytes: Uint8Array): boolean => {
  const ascii = String.fromCharCode(...bytes.subarray(0, 8));
  return (bytes[0] === 0x89 && ascii.slice(1, 4) === "PNG") || ascii.startsWith("GIF8") || ascii.startsWith("<svg")
    || (bytes[0] === 0xff && bytes[1] === 0xd8) || (bytes[0] === 0x42 && bytes[1] === 0x4d)
    || (bytes[0] === 0xd7 && bytes[1] === 0xcd) || (bytes[0] === 0x01 && bytes[1] === 0x00);
};

describe("published Word release — every authoritative page", () => {
  it.each(wordWorks)("renders and owns all pages of $title", work => {
    const word = work.sources.find(source => source.format === "word")!;
    const model = extractFromDocx(new Uint8Array(readFileSync(new URL(word.path.replace(/^\.\//, ""), publicRoot))));
    const map = JSON.parse(readFileSync(new URL(work.wordArtifact!.path.replace(/^\.\//, ""), publicRoot), "utf8")) as PageMap;
    expect(map.totalPages).toBe(work.wordArtifact!.totalPages);
    expect(map.paragraphCount).toBe(work.wordArtifact!.paragraphCount);
    const groups = groupsFromWordPageMap(model, map as unknown as Parameters<typeof groupsFromWordPageMap>[1]);
    expect(groups).not.toBeNull();
    expect(auditWordPageMap(model, map as unknown as Parameters<typeof auditWordPageMap>[1]).mismatches).toEqual([]);
    const ownership = new Int32Array(model.paragraphs.length); ownership.fill(-1);
    const paragraphIndexes = new Map(model.paragraphs.map((paragraph, index) => [paragraph, index]));
    for (let physical = 0; physical < groups!.length; physical++) {
      for (const paragraph of groups![physical]!) {
        const index = paragraphIndexes.get(paragraph)!;
        expect(ownership[index]).toBe(-1);
        ownership[index] = physical;
      }
    }
    expect(Array.from(ownership).every(page => page >= 0)).toBe(true);

    const rendered = renderDocument(model, groups!) as unknown as FakeNode;
    const nodes = descendants(rendered), pages = nodes.filter(node => node.attrs.get("class")?.split(/\s+/).includes("page"));
    expect(pages).toHaveLength(map.totalPages);
    expect(map.pages.map(page => page.physicalPage)).toEqual(Array.from({ length: map.totalPages }, (_, index) => index + 1));
    expect(map.pages.every(page => Number.isInteger(page.adjustedPage))).toBe(true);

    for (const node of nodes) {
      expect([...node.attrs.values()].every(finiteCss)).toBe(true);
      expect(Object.values(node.style).every(finiteCss)).toBe(true);
    }
    const sourceText = normalizedText(model.paragraphs.map(paragraph => paragraph.text).join(" "));
    const renderedText = normalizedText(rendered.textContent);
    expect(renderedText.includes("\ufffd")).toBe(sourceText.includes("\ufffd"));

    for (const bytes of model.mediaFiles.values()) {
      expect(bytes.byteLength).toBeGreaterThan(0);
      expect(validImage(bytes)).toBe(true);
    }
    for (const paragraph of model.paragraphs) {
      if (!paragraph.bookmarkIds?.length) continue;
      expect(ownership[paragraphIndexes.get(paragraph)!]).toBeGreaterThanOrEqual(0);
    }
    for (const section of model.sections) {
      for (const part of [...Object.values(section.headerRefs ?? {}), ...Object.values(section.footerRefs ?? {})])
        expect(model.headerFooters.has(part)).toBe(true);
    }
    const pagesWith = (predicate: (paragraph: (typeof model.paragraphs)[number]) => boolean): number =>
      groups!.filter(group => group.some(predicate)).length;
    const hasAnchor = (paragraph: (typeof model.paragraphs)[number]): boolean =>
      (paragraph.anchors?.length ?? 0) > 0 || paragraph.runs.some(run => (run.inlineAnchors?.length ?? 0) > 0);
    const hasNote = (paragraph: (typeof model.paragraphs)[number]): boolean => paragraph.runs.some(run => Boolean(run.noteRef));
    const hasMarginStory = (physical: number): boolean => {
      const group = groups![physical - 1]!, section = model.sections[group[0]?.sectionIndex ?? 0];
      return Boolean(Object.keys(section?.headerRefs ?? {}).length || Object.keys(section?.footerRefs ?? {}).length);
    };
    riskSummary.push({ title: work.title,
      cover: groups![0]?.some(hasAnchor) ? 1 : 0,
      images: pagesWith(hasAnchor),
      tables: pagesWith(paragraph => Boolean(paragraph.tableCell)),
      notes: pagesWith(hasNote),
      margins: groups!.filter((_group, index) => hasMarginStory(index + 1)).length,
      bookmarks: pagesWith(paragraph => Boolean(paragraph.bookmarkIds?.length)),
    });
  }, 120_000);

  it("covers high-risk page classes across the six-work release", () => {
    expect(riskSummary).toHaveLength(6);
    const total = (key: keyof Omit<(typeof riskSummary)[number], "title">): number =>
      riskSummary.reduce((sum, work) => sum + work[key], 0);
    expect(total("images")).toBeGreaterThan(0);
    expect(total("tables")).toBeGreaterThan(0);
    expect(total("notes")).toBeGreaterThan(0);
    expect(total("margins")).toBeGreaterThan(0);
    expect(total("bookmarks")).toBeGreaterThan(0);
    console.log("published_word_high_risk_pages", JSON.stringify(riskSummary));
  });
});

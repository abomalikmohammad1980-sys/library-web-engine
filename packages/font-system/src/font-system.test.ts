import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  normalizeFamily, familyCandidates, registryProvider, fontRequest, KNOWN_ALIASES,
} from "./index.js";

const JAZEERA = new URL("../../../corpus/book-fonts/Al-Jazeera-Arabic-Regular.ttf", import.meta.url);
const BOLD = new URL("../../../corpus/book-fonts/Al-Jazeera-Arabic-Bold.ttf", import.meta.url);

function registry(): Record<string, Uint8Array> {
  const regular = readFileSync(JAZEERA);
  const bold = readFileSync(BOLD);
  return {
    "al-jazeera arabic": regular,
    "al-jazeera-arabic-regular": regular,
    "al-jazeera arabic bold": bold,
    "al-jazeera-arabic-bold": bold,
  };
}

describe("normalizeFamily", () => {
  it("lowercases, collapses whitespace and trims", () => {
    expect(normalizeFamily("  Al-Jazeera   Arabic ")).toBe("al-jazeera arabic");
  });
});

describe("familyCandidates", () => {
  it("prefers an explicit bold face name, then the bare family", () => {
    expect(familyCandidates("Al-Jazeera Arabic", true, false)).toEqual([
      "al-jazeera arabic bold", "al-jazeera arabic-bold", "al-jazeera arabicbold",
      "al-jazeera arabic",
    ]);
  });
  it("returns only the bare family for regular", () => {
    expect(familyCandidates("Traditional Arabic")).toEqual(["traditional arabic"]);
  });
});

describe("registryProvider", () => {
  it("resolves the exact bold face when present", async () => {
    const p = registryProvider(registry());
    const bold = await p.resolveFont({ family: "al-jazeera arabic", bold: true });
    const regular = await p.resolveFont({ family: "al-jazeera arabic" });
    expect(bold).not.toBeNull();
    expect(regular).not.toBeNull();
    expect(bold).not.toBe(regular);
  });
  it("falls back to the default face when nothing matches", async () => {
    const p = registryProvider(registry(), "Al-Jazeera-Arabic-Regular");
    const bytes = await p.resolveFont({ family: "missing font family" });
    expect(bytes).not.toBeNull();
  });
  it("reports whether resolution was exact or substituted", async () => {
    const p = registryProvider(registry(), "Al-Jazeera-Arabic-Regular");
    expect(await p.resolveFontDetailed?.({ family: "al-jazeera arabic" }))
      .toMatchObject({ resolvedFamily: "al-jazeera arabic", source: "exact" });
    expect(await p.resolveFontDetailed?.({ family: "Traditional Arabic",
      fallbackFamily: "Al-Jazeera-Arabic-Regular" }))
      .toMatchObject({ resolvedFamily: "Al-Jazeera-Arabic-Regular", source: "fallback-family" });
    expect(await p.resolveFontDetailed?.({ family: "unknown" }))
      .toMatchObject({ resolvedFamily: "Al-Jazeera-Arabic-Regular", source: "default" });
  });
  it("returns null when nothing matches and no fallback is given", async () => {
    const p = registryProvider({});
    expect(await p.resolveFont({ family: "missing font family" })).toBeNull();
  });
});

describe("fontRequest + KNOWN_ALIASES", () => {
  it("maps a known alias to a fallback family", () => {
    const req = fontRequest("Sakkal Majalla");
    expect(req.family).toBe("sakkal majalla");
    expect(req.fallbackFamily).toBe(KNOWN_ALIASES["sakkal majalla"]);
  });
  it("defaults to Al-Jazeera for a null family", () => {
    expect(fontRequest(null).family).toBe("Al-Jazeera-Arabic-Regular");
  });
  it("sets bold/italic only when defined (exactOptionalPropertyTypes)", () => {
    const req = fontRequest("X", true, undefined);
    expect("italic" in req).toBe(false);
    expect(req.bold).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  emu,
  emuToTwips,
  halfPointsToTwips,
  pointsToTwips,
  twips,
  twipsToCssPx,
  twipsToEmu,
  twipsToPoints,
} from "./units.js";

describe("شبكة الوحدات (ADR-0004)", () => {
  it("ترفض القيم غير الصحيحة — الشبكة أعداد صحيحة حصرًا", () => {
    expect(() => twips(1.5)).toThrow(RangeError);
    expect(() => emu(0.1)).toThrow(RangeError);
  });

  it("تحوّل النقاط إلى twips على ثابت المواصفة (1pt = 20 twips)", () => {
    expect(pointsToTwips(12)).toBe(240);
    expect(twipsToPoints(twips(240))).toBe(12);
  });

  it("تحوّل أنصاف النقاط (صيغة w:sz) — حجم خط 24 half-pt = 12pt = 240 twips", () => {
    expect(halfPointsToTwips(24)).toBe(240);
  });

  it("تحوّل EMU ذهابًا وإيابًا (1in = 914400 EMU = 1440 twips)", () => {
    expect(emuToTwips(emu(914400))).toBe(1440);
    expect(twipsToEmu(twips(1440))).toBe(914400);
  });

  it("هامش صفحة نموذجي من XML حقيقي: w:top=1440 twips = بوصة = 96 بكسل CSS", () => {
    expect(twipsToCssPx(twips(1440))).toBe(96);
    expect(twipsToCssPx(twips(1440), 2)).toBe(192);
  });
});

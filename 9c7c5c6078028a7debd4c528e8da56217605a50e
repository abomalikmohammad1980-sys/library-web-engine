import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { discoverWordCover, selectCoverCandidate } from "./index.js";
const poetryCorpus = new URL("../../../../../كتب للاختبار/همومٌ وآلام.. ديوان شعري.docx", import.meta.url);
describe("word cover",()=>{
  it("keeps the general geometric selector",()=>{expect(selectCoverCandidate([{mediaPath:"logo",width:10,height:10,pageWidth:1000,pageHeight:1500,inline:true},{mediaPath:"cover",width:700,height:1100,pageWidth:1000,pageHeight:1500,inline:false}])?.mediaPath).toBe("cover")});
  it.runIf(existsSync(poetryCorpus))("discovers the full-page VML cover in the poetry corpus",()=>{
    const bytes = new Uint8Array(readFileSync(poetryCorpus));
    const cover = discoverWordCover(bytes);
    expect(cover?.bytes.length).toBeGreaterThan(80_000);
    expect(cover?.mediaPath).toMatch(/image(?:1|6)\.jpeg$/);
  });
  it("discovers a real corpus cover when present",()=>{const dir=new URL("../../../corpus/books/",import.meta.url);const found=readdirSync(dir).filter(f=>f.startsWith("sample-")&&f.endsWith(".docx")).map(f=>discoverWordCover(readFileSync(new URL(f,dir)))).find(Boolean);expect(found?.bytes.byteLength).toBeGreaterThan(0);expect(found?.mimeType).toMatch(/^image\//);});
});

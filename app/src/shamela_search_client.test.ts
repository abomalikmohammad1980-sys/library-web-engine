import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import {
  createSearchWorkerHandler,
  ArabicSearchShard,
  type SearchWorkerRequest,
  type SearchWorkerResponse,
} from "../../packages/search/src/index";
import { ShamelaSearchClient, type WorkerPort } from "./shamela_search_client";
import { searchResultHref } from "./screens/search";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

class LocalWorker implements WorkerPort {
  listeners: Array<(e: MessageEvent<SearchWorkerResponse>) => void> = [];
  handle = createSearchWorkerHandler();
  postMessage(v: SearchWorkerRequest) {
    const data = this.handle(v);
    queueMicrotask(() =>
      this.listeners.forEach((fn) =>
        fn({ data } as MessageEvent<SearchWorkerResponse>),
      ),
    );
  }
  addEventListener(
    _: "message",
    fn: (e: MessageEvent<SearchWorkerResponse>) => void,
  ) {
    this.listeners.push(fn);
  }
}
const response = (value: unknown) => Response.json(value);
describe("lazy Shamela search worker", () => {
  it("does not invoke the browser fetch method unbound", () => {
    const source = readFileSync(resolve(__dirname, "shamela_search_client.ts"), "utf8");
    expect(source).toContain("(input,init)=>globalThis.fetch(input,init)");
    expect(source).not.toContain("fetcher:typeof fetch=fetch");
  });
  it("loads only a requested shard and links its hit to page position", async () => {
    const shard = ArabicSearchShard.build("shamela-1", [
        {
          id: "1:7",
          bookId: "1",
          paragraphIndex: 6,
          text: "هذا متن البحث الذهبي",
        },
      ]).serialize(),
      bytes = new TextEncoder().encode(JSON.stringify(shard));
    const hash = [
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      ]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join(""),
      calls: string[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      return url.endsWith("manifest.json")
        ? response({
            contract: "x",
            shards: [
              {
                id: "shamela-1",
                bookId: "1",
                file: "shards/1.json",
                byteLength: bytes.length,
                sha256: hash,
              },
              {
                id: "shamela-2",
                bookId: "2",
                file: "shards/2.json",
                byteLength: 1,
                sha256: "x",
              },
            ],
          })
        : response(shard);
    }) as typeof fetch;
    const client = new ShamelaSearchClient(new LocalWorker(), fetcher),
      page = await client.search("البحث الذهبي", 0, 40, ["shamela-1"]);
    expect(page.hits[0]).toMatchObject({ bookId: "1", paragraphIndex: 6 });
    expect(searchResultHref({ bookId: "shamela-1", paraIndex: 6 })).toBe(
      "#/reader/shamela-1?pageIndex=6",
    );
    expect(calls).not.toContain("./library/shamela-search/shards/2.json");
  });
  it("uses exact routing buckets and never downloads an unrelated book shard", async () => {
    const shard = ArabicSearchShard.build("hit", [{ id:"10:1", bookId:"10", paragraphIndex:0, text:"باب تكليف المكره" }]).serialize(), bytes=new TextEncoder().encode(JSON.stringify(shard)), hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(x=>x.toString(16).padStart(2,"0")).join(""), calls:string[]=[];
    const fnv=(gram:string)=>{let h=2166136261;for(let i=0;i<gram.length;i++){h^=gram.charCodeAt(i);h=Math.imul(h,16777619)}return String((h>>>0)%16).padStart(4,"0")}, grams=[...new Set(Array.from({length:"تكليف المكره".length-2},(_,i)=>"تكليف المكره".slice(i,i+3)))];
    const fetcher=(async(input:RequestInfo|URL)=>{const url=String(input);calls.push(url);if(url.endsWith("shamela-search/manifest.json"))return response({contract:"x",routing:{manifest:"routing/manifest.json"},integrity:{shardsDigestSha256:"s"},shards:[{id:"hit",bookId:"10",batch:"batch-0000",file:"hit.json",byteLength:bytes.length,sha256:hash},{id:"miss",bookId:"20",batch:"batch-0001",file:"miss.json",byteLength:1,sha256:"x"}]});if(url.endsWith("routing/manifest.json"))return response({contract:"shamela-search-route/manifest-1",bucketCount:16,globalPattern:"routing/global/{bucket}.json",batchPattern:"routing/batches/{batch}/{bucket}.json",batches:["batch-0000","batch-0001"]});const bucket=/\/(\d{4})\.json$/u.exec(url)?.[1],entries=grams.filter(gram=>fnv(gram)===bucket);if(url.includes("routing/global/"))return response({entries:entries.map(gram=>[gram,["batch-0000"]])});if(url.includes("routing/batches/batch-0000/"))return response({entries:entries.map(gram=>[gram,["hit"]])});if(url.endsWith("hit.json"))return response(shard);return {ok:false,status:404} as Response}) as typeof fetch;
    const page=await new ShamelaSearchClient(new LocalWorker(),fetcher).search("تكليف المكره",0,40);expect(page.total).toBe(1);expect(page.coverageComplete).toBe(true);expect(calls).toContain("./library/shamela-search/hit.json");expect(calls).not.toContain("./library/shamela-search/miss.json");
  });
  it("returns first result under one second and paginates 10k matches", async () => {
    const docs = Array.from({ length: 10_000 }, (_, i) => ({
        id: `1:${i}`,
        bookId: "1",
        paragraphIndex: i,
        text: `عبارة ذهبية ${i}`,
      })),
      shard = ArabicSearchShard.build("shamela-1", docs).serialize(),
      bytes = new TextEncoder().encode(JSON.stringify(shard)),
      hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join(""),
      fetcher = (async (input: RequestInfo | URL) =>
        String(input).endsWith("manifest.json")
          ? response({
              contract: "x",
              shards: [
                {
                  id: "shamela-1",
                  bookId: "1",
                  file: "shards/1.json",
                  byteLength: bytes.length,
                  sha256: hash,
                },
              ],
            })
          : response(shard)) as typeof fetch,
      client = new ShamelaSearchClient(new LocalWorker(), fetcher),
      started = performance.now(),
      first = await client.search("عبارة ذهبية", 0, 40),
      elapsed = performance.now() - started,
      last = await client.search("عبارة ذهبية", 9960, 40);
    expect(elapsed).toBeLessThan(1000);
    expect(first.total).toBe(10_000);
    expect(first.hits).toHaveLength(40);
    expect(last.hits[0]?.paragraphIndex).toBe(9960);
  });
  it("keeps healthy hits and reports the exact unavailable book when another shard fails", async () => {
    const good = ArabicSearchShard.build("shamela-10", [
        {
          id: "10:3",
          bookId: "10",
          paragraphIndex: 2,
          text: "باب تكليف المكره",
        },
      ]).serialize(),
      bytes = new TextEncoder().encode(JSON.stringify(good)),
      hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join(""),
      fetcher = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("manifest.json"))
          return response({
            contract: "x",
            counts: { books: 2, documents: 2, postings: 2 },
            source: { booksDigestSha256: "digest" },
            shards: [
              {
                id: "shamela-10",
                bookId: "10",
                file: "shards/10.json",
                byteLength: bytes.length,
                sha256: hash,
              },
              {
                id: "shamela-bad",
                bookId: "99",
                file: "shards/99.json",
                byteLength: 5,
                sha256: "bad",
              },
            ],
          });
        if (url.endsWith("10.json")) return response(good);
        return { ok: false, status: 404 } as Response;
      }) as typeof fetch,
      page = await new ShamelaSearchClient(new LocalWorker(), fetcher).search(
        "تكليف المكره",
        0,
        40,
        ["410000010", "410000099"],
      );
    expect(page.hits[0]).toMatchObject({ bookId: "10", paragraphIndex: 2 });
    expect(page.unavailableBookIds).toEqual(["99"]);
    expect(searchResultHref({ bookId: "410000010", paraIndex: 2 })).toBe(
      "#/reader/410000010?pageIndex=2",
    );
  });
  it("finds the golden raw phrase from book 10 through the checked-in inverted shard", async () => {
    const root = resolve(process.cwd(), "app/public/library"),
      manifest = JSON.parse(
        readFileSync(resolve(root, "shamela-search/manifest.json"), "utf8"),
      ),
      source = JSON.parse(
        readFileSync(resolve(root, "shamela-sample/books/10.json"), "utf8"),
      ),
      raw = source.titles.find((row: { title?: string }) =>
        row.title?.includes("تكليف المكره"),
      );
    expect(raw?.title).toContain("تكليف المكره");
    const fetcher = (async (input: RequestInfo | URL) => {
        const relative = String(input).replace(/^\.\/library\//, "");
        try {
          const bytes = readFileSync(resolve(root, relative));
          return new Response(bytes, {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch {
          return new Response(null, { status: 404 });
        }
      }) as typeof fetch,
      client = new ShamelaSearchClient(new LocalWorker(), fetcher),
      started = performance.now(),
      plain = await client.search("تكليف المكره", 0, 40, ["410000010"]),
      normalized = await client.search("تَكْلِيف   المُكْرَه", 0, 40, [
        "410000010",
      ]);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(manifest.counts.books).toBeGreaterThanOrEqual(100);
    expect(manifest.counts.documents).toBeGreaterThanOrEqual(179500);
    expect(manifest.source.batchesDigestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(plain.hits.some((hit) => hit.text.includes("تكليف المكره"))).toBe(
      true,
    );
    expect(normalized.total).toBe(plain.total);
    expect(plain.unavailableBookIds).toEqual([]);
  });
  it("aborts a stalled v2 search promptly so the UI can recover automatically", async () => {
    const stalled = (() => new Promise<Response>(() => undefined)) as typeof fetch;
    const client = new ShamelaSearchClient(new LocalWorker(), stalled, stalled);
    const controller = new AbortController();
    const started = performance.now();
    setTimeout(() => controller.abort("search_ui_timeout"), 10);
    await expect(client.searchCompleteV2("إنما الأعمال بالنيات", 0, 40, undefined, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(performance.now() - started).toBeLessThan(500);
  });
});

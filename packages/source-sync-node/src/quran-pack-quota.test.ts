import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeQuranPackQuotaPlan, planQuranPackQuota, type QuranPackQuotaEntry } from "./quran-pack-quota.js";

const roots: string[] = [];
afterEach(() => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
const entry = (directory: string, byteSize: number, role: QuranPackQuotaEntry["role"], lastAccessedAt: string): QuranPackQuotaEntry => ({ directory, byteSize, role, lastAccessedAt });

describe("Quran pack quota planning", () => {
  it("pins active and previous while selecting inactive LRU candidates", () => {
    const plan = planQuranPackQuota([
      entry("active-pack", 100, "active", "2020-01-01T00:00:00Z"),
      entry("previous-pack", 100, "previous", "2020-01-01T00:00:00Z"),
      entry("old-pack", 80, "inactive", "2021-01-01T00:00:00Z"),
      entry("new-pack", 80, "inactive", "2022-01-01T00:00:00Z"),
    ], { maxBytes: 250, minimumFreeBytes: 200, dryRun: true }, 150);
    expect(plan.evict).toEqual([{ directory: "old-pack", byteSize: 80 }, { directory: "new-pack", byteSize: 80 }]);
    expect(plan.status).toBe("ready");
    expect(plan.planId).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reports insufficient candidates instead of evicting pinned packs", () => {
    const plan = planQuranPackQuota([entry("active-pack", 500, "active", "2020-01-01T00:00:00Z")], { maxBytes: 100, minimumFreeBytes: 0, dryRun: true }, 1000);
    expect(plan).toMatchObject({ status: "insufficient-candidates", evict: [], requiredReclaimBytes: 400 });
  });
});

describe("Quran pack quota execution", () => {
  it("requires explicit non-dry-run approval and removes only planned directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "quran-quota-"));
    roots.push(root);
    for (const directory of ["active-pack", "previous-pack", "old-pack"]) { await mkdir(join(root, directory)); await writeFile(join(root, directory, "marker"), directory); }
    const entries = [entry("active-pack", 100, "active", "2020-01-01T00:00:00Z"), entry("previous-pack", 100, "previous", "2020-01-01T00:00:00Z"), entry("old-pack", 100, "inactive", "2020-01-01T00:00:00Z")];
    const dry = planQuranPackQuota(entries, { maxBytes: 200, minimumFreeBytes: 0, dryRun: true }, 1000);
    await expect(executeQuranPackQuotaPlan(root, dry, dry.planId, ["active-pack", "previous-pack"])).rejects.toThrow(/dry_run/);
    const approved = planQuranPackQuota(entries, { maxBytes: 200, minimumFreeBytes: 0, dryRun: false }, 1000);
    await expect(executeQuranPackQuotaPlan(root, approved, "0".repeat(64), ["active-pack", "previous-pack"])).rejects.toThrow(/approval/);
    await expect(executeQuranPackQuotaPlan(root, { ...approved, evict: [{ directory: "active-pack", byteSize: 100 }] }, approved.planId, ["active-pack", "previous-pack"])).rejects.toThrow(/approval/);
    await expect(executeQuranPackQuotaPlan(root, approved, approved.planId, ["old-pack"])).rejects.toThrow(/protected/);
    const livePointer = join(root, "changed.active.json");
    await writeFile(livePointer, JSON.stringify({ directory: "old-pack", previous: null }));
    await expect(executeQuranPackQuotaPlan(root, approved, approved.planId, ["active-pack", "previous-pack"])).rejects.toThrow(/protected/);
    await rm(livePointer);
    expect(await executeQuranPackQuotaPlan(root, approved, approved.planId, ["active-pack", "previous-pack"])).toEqual({ removed: ["old-pack"], reclaimedBytes: 100 });
    expect(await readFile(join(root, "active-pack", "marker"), "utf8")).toBe("active-pack");
    expect(await readFile(join(root, "previous-pack", "marker"), "utf8")).toBe("previous-pack");
    await expect(readFile(join(root, "old-pack", "marker"))).rejects.toThrow();
  });
});

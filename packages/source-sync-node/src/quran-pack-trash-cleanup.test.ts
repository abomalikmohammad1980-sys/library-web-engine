import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeQuranPackTrashCleanup, planQuranPackTrashCleanup } from "./quran-pack-quota.js";

const roots: string[] = [];
afterEach(() => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));

describe("Quran pack crash-trash cleanup", () => {
  it("plans only aged internal trash and requires explicit unchanged approval", async () => {
    const root = await mkdtemp(join(tmpdir(), "quran-trash-cleanup-"));
    roots.push(root);
    const oldTrash = ".quota-trash-00000000-0000-4000-8000-000000000001";
    const recentTrash = ".quota-trash-00000000-0000-4000-8000-000000000002";
    for (const directory of [oldTrash, recentTrash, "active-pack"]) { await mkdir(join(root, directory)); await writeFile(join(root, directory, "marker"), directory); }
    await utimes(join(root, oldTrash), new Date("2026-08-09T00:00:00Z"), new Date("2026-08-09T00:00:00Z"));
    const now = new Date("2026-08-09T02:00:00Z");
    const dry = await planQuranPackTrashCleanup(root, 60 * 60 * 1000, true, now);
    expect(dry.remove.map(item => item.directory)).toEqual([oldTrash]);
    await expect(executeQuranPackTrashCleanup(root, dry, dry.planId, now)).rejects.toThrow(/dry_run/);
    const approved = await planQuranPackTrashCleanup(root, 60 * 60 * 1000, false, now);
    await expect(executeQuranPackTrashCleanup(root, { ...approved, minimumAgeMs: 60_000 }, approved.planId, now)).rejects.toThrow(/approval/);
    expect(await executeQuranPackTrashCleanup(root, approved, approved.planId, now)).toEqual({ removed: [oldTrash] });
    await expect(readFile(join(root, oldTrash, "marker"))).rejects.toThrow();
    expect(await readFile(join(root, recentTrash, "marker"), "utf8")).toBe(recentTrash);
    expect(await readFile(join(root, "active-pack", "marker"), "utf8")).toBe("active-pack");
  });

  it("fails closed when trash changed after approval", async () => {
    const root = await mkdtemp(join(tmpdir(), "quran-trash-changed-"));
    roots.push(root);
    const trash = ".quota-trash-00000000-0000-4000-8000-000000000003";
    await mkdir(join(root, trash));
    await utimes(join(root, trash), new Date("2026-08-09T00:00:00Z"), new Date("2026-08-09T00:00:00Z"));
    const now = new Date("2026-08-09T02:00:00Z");
    const plan = await planQuranPackTrashCleanup(root, 60 * 60 * 1000, false, now);
    await writeFile(join(root, trash, "new-file"), "changed");
    await utimes(join(root, trash), now, now);
    await expect(executeQuranPackTrashCleanup(root, plan, plan.planId, now)).rejects.toThrow(/changed/);
    expect(await readFile(join(root, trash, "new-file"), "utf8")).toBe("changed");
  });
});

import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export interface QuranPackQuotaEntry {
  directory: string;
  byteSize: number;
  lastAccessedAt: string;
  role: "active" | "previous" | "inactive";
}

export interface QuranPackQuotaPolicy {
  maxBytes: number;
  minimumFreeBytes: number;
  dryRun: boolean;
}

export interface QuranPackQuotaPlan {
  schemaVersion: 1;
  planId: string;
  dryRun: boolean;
  totalBytes: number;
  requiredReclaimBytes: number;
  plannedReclaimBytes: number;
  status: "within-quota" | "ready" | "insufficient-candidates";
  evict: readonly { directory: string; byteSize: number }[];
}

export interface QuranPackTrashCleanupPlan {
  schemaVersion: 1;
  planId: string;
  dryRun: boolean;
  createdAt: string;
  minimumAgeMs: number;
  remove: readonly { directory: string; modifiedAt: string }[];
}

export function planQuranPackQuota(entries: readonly QuranPackQuotaEntry[], policy: QuranPackQuotaPolicy, freeBytes: number): QuranPackQuotaPlan {
  if (![policy.maxBytes, policy.minimumFreeBytes, freeBytes].every(value => Number.isSafeInteger(value) && value >= 0)) throw Error("quran_pack_quota_policy_invalid");
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!safeName(entry.directory) || seen.has(entry.directory) || !Number.isSafeInteger(entry.byteSize) || entry.byteSize < 0 || !Number.isFinite(Date.parse(entry.lastAccessedAt))) throw Error("quran_pack_quota_entry_invalid");
    seen.add(entry.directory);
  }
  const totalBytes = entries.reduce((sum, entry) => sum + entry.byteSize, 0);
  const requiredReclaimBytes = Math.max(0, totalBytes - policy.maxBytes, policy.minimumFreeBytes - freeBytes);
  let plannedReclaimBytes = 0;
  const evict: { directory: string; byteSize: number }[] = [];
  const candidates = entries.filter(entry => entry.role === "inactive").sort((a, b) => Date.parse(a.lastAccessedAt) - Date.parse(b.lastAccessedAt) || a.directory.localeCompare(b.directory));
  for (const entry of candidates) {
    if (plannedReclaimBytes >= requiredReclaimBytes) break;
    evict.push({ directory: entry.directory, byteSize: entry.byteSize });
    plannedReclaimBytes += entry.byteSize;
  }
  const status: QuranPackQuotaPlan["status"] = requiredReclaimBytes === 0 ? "within-quota" : plannedReclaimBytes >= requiredReclaimBytes ? "ready" : "insufficient-candidates";
  const body: Omit<QuranPackQuotaPlan, "planId"> = { schemaVersion: 1, dryRun: policy.dryRun, totalBytes, requiredReclaimBytes, plannedReclaimBytes, status, evict };
  return { ...body, planId: hashPlan(body) };
}

export async function executeQuranPackQuotaPlan(rootDirectory: string, plan: QuranPackQuotaPlan, approvedPlanId: string, protectedDirectories: readonly string[]) {
  if (plan.dryRun) throw Error("quran_pack_quota_dry_run");
  const { planId: _planId, ...body } = plan;
  if (plan.status !== "ready" || approvedPlanId !== plan.planId || hashPlan(body) !== plan.planId) throw Error("quran_pack_quota_approval_invalid");
  const root = resolve(rootDirectory);
  return withPackLock(root, async () => {
  if (new Set(protectedDirectories).size !== protectedDirectories.length || protectedDirectories.some(directory => !safeName(directory))) throw Error("quran_pack_quota_protection_invalid");
  const liveProtected = await readLiveProtectedDirectories(root);
  const protectedSet = new Set([...protectedDirectories, ...liveProtected]);
  if (plan.evict.some(item => protectedSet.has(item.directory))) throw Error("quran_pack_quota_protected");
  const removed: string[] = [];
  for (const item of plan.evict) {
    if (!safeName(item.directory)) throw Error("quran_pack_quota_entry_invalid");
    const source = contained(root, item.directory);
    const metadata = await lstat(source);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw Error("quran_pack_quota_path_unsafe");
    const trashName = `.quota-trash-${randomUUID()}`;
    const trash = contained(root, trashName);
    await rename(source, trash);
    await rm(trash, { recursive: true, force: true });
    removed.push(item.directory);
  }
  return { removed, reclaimedBytes: plan.evict.reduce((sum, item) => sum + item.byteSize, 0) };
  });
}

export async function planQuranPackTrashCleanup(rootDirectory: string, minimumAgeMs: number, dryRun = true, now = new Date()): Promise<QuranPackTrashCleanupPlan> {
  if (!Number.isSafeInteger(minimumAgeMs) || minimumAgeMs < 60_000 || !Number.isFinite(now.getTime())) throw Error("quran_pack_trash_policy_invalid");
  const root = resolve(rootDirectory);
  await mkdir(root, { recursive: true });
  const remove: { directory: string; modifiedAt: string }[] = [];
  for (const directory of (await readdir(root)).sort()) {
    if (!/^\.quota-trash-[0-9a-f-]{36}$/i.test(directory)) continue;
    const metadata = await lstat(contained(root, directory));
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw Error("quran_pack_trash_path_unsafe");
    if (now.getTime() - metadata.mtimeMs >= minimumAgeMs) remove.push({ directory, modifiedAt: metadata.mtime.toISOString() });
  }
  const body: Omit<QuranPackTrashCleanupPlan, "planId"> = { schemaVersion: 1, dryRun, createdAt: now.toISOString(), minimumAgeMs, remove };
  return { ...body, planId: hashTrashPlan(body) };
}

export async function executeQuranPackTrashCleanup(rootDirectory: string, plan: QuranPackTrashCleanupPlan, approvedPlanId: string, now = new Date()) {
  const { planId: _planId, ...body } = plan;
  if (plan.dryRun) throw Error("quran_pack_trash_dry_run");
  if (approvedPlanId !== plan.planId || hashTrashPlan(body) !== plan.planId || !Number.isFinite(now.getTime())) throw Error("quran_pack_trash_approval_invalid");
  const root = resolve(rootDirectory);
  return withPackLock(root, async () => {
    const removed: string[] = [];
    for (const item of plan.remove) {
      if (!/^\.quota-trash-[0-9a-f-]{36}$/i.test(item.directory)) throw Error("quran_pack_trash_path_unsafe");
      const path = contained(root, item.directory);
      const metadata = await lstat(path);
      if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.mtime.toISOString() !== item.modifiedAt || now.getTime() - metadata.mtimeMs < plan.minimumAgeMs) throw Error("quran_pack_trash_changed");
      await rm(path, { recursive: true, force: true });
      removed.push(item.directory);
    }
    return { removed };
  });
}

function safeName(value: string) { return basename(value) === value && /^[a-z0-9][a-z0-9._-]{2,159}$/i.test(value); }
function contained(root: string, value: string) { const path = resolve(root, value); if (!path.startsWith(root + sep)) throw Error("quran_pack_quota_path_escape"); return path; }
function hashPlan(value: Omit<QuranPackQuotaPlan, "planId">) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function hashTrashPlan(value: Omit<QuranPackTrashCleanupPlan, "planId">) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
async function readLiveProtectedDirectories(root: string) {
  const protectedDirectories: string[] = [];
  for (const name of await readdir(root)) {
    if (!name.endsWith(".active.json")) continue;
    try {
      const pointer = JSON.parse(await readFile(contained(root, name), "utf8")) as { directory?: string; previous?: { directory?: string } | null };
      if (pointer.directory && safeName(pointer.directory)) protectedDirectories.push(pointer.directory);
      if (pointer.previous?.directory && safeName(pointer.previous.directory)) protectedDirectories.push(pointer.previous.directory);
    } catch { throw Error("quran_pack_quota_pointer_invalid"); }
  }
  return protectedDirectories;
}
async function withPackLock<T>(root: string, operation: () => Promise<T>) {
  await mkdir(root, { recursive: true });
  const lock = contained(root, ".quran-pack-manager.lock");
  const deadline = Date.now() + 5_000;
  while (true) {
    try { await mkdir(lock); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const age = await stat(lock).then(item => Date.now() - item.mtimeMs).catch(() => 0);
      if (age > 30_000) { await rm(lock, { recursive: true, force: true }); continue; }
      if (Date.now() >= deadline) throw Error("quran_pack_lock_timeout");
      await delay(25);
    }
  }
  try { return await operation(); }
  finally { await rm(lock, { recursive: true, force: true }); }
}

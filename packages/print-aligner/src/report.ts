import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import type { AlignmentReport } from "./types.js";
export async function writeReport(path: string, report: AlignmentReport) { await writeFile(path, JSON.stringify(report, null, 2), "utf8") }
export const reportHash = (report: AlignmentReport) => createHash("sha256").update(JSON.stringify(report)).digest("hex");
export async function readReport(path: string): Promise<AlignmentReport> { return JSON.parse(await readFile(path, "utf8")) as AlignmentReport }

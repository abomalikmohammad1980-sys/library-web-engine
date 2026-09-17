import { describe, expect, it } from "vitest";
import { runLocalStagingGate } from "./local-staging-gate.js";

describe("repeatable local staging gate", () => {
  it("applies 0001-0011 and repeats the two-device smoke on isolated databases", async () => {
    const expected = { migrations: 11, ready: true, health: true, legacyRevisions: 3, backfilledEditions: 4, activeDevices: 2, conflict: "archived", rollback: "published", quarantine: "allowed", cache: "delivered", triggers: ["source_conflict_resolution_cas", "source_edition_attachment_cas"] };
    await expect(runLocalStagingGate()).resolves.toEqual(expected);
    await expect(runLocalStagingGate()).resolves.toEqual(expected);
  });
});

import { describe, expect, it } from "vitest";
import { cloudflareAuthenticator } from "./identity.js";

describe("Cloudflare identity boundary", () => {
  it("accepts accounts and rejects guests before source authority", async () => {
    const account = cloudflareAuthenticator({ verifyBearer: async () => ({ kind: "account", userId: "user-1" }) });
    await expect(account.authenticate(new Request("https://x", { headers: { authorization: "Bearer token" } }))).resolves.toEqual({ userId: "user-1" });
    const guest = cloudflareAuthenticator({ verifyBearer: async () => ({ kind: "guest" }) });
    await expect(guest.authenticate(new Request("https://x", { headers: { authorization: "Bearer guest" } }))).rejects.toMatchObject({ code: "account_required", status: 401 });
  });
});

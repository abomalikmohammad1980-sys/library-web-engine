import type { SyncAccountUsage } from "@library/source-sync";
import type { AuthenticatedPrincipal } from "./contracts.js";

export interface AccountUsageStore {
  get(userId: string): Promise<SyncAccountUsage | null>;
}

const PRIVATE_HEADERS = { "cache-control": "private, no-store" } as const;

export class AccountUsageHttpRouter {
  constructor(
    private readonly store: AccountUsageStore,
    private readonly auth: { authenticate(r: Request): Promise<AuthenticatedPrincipal> },
  ) {}

  async handle(r: Request) {
    try {
      if (r.method !== "GET") {
        return Response.json(
          { error: { code: "method_not_allowed" } },
          { status: 405, headers: { ...PRIVATE_HEADERS, allow: "GET" } },
        );
      }
      const principal = await this.auth.authenticate(r);
      const usage = await this.store.get(principal.userId);
      return Response.json(usage ?? { error: { code: "usage_not_found" } }, {
        status: usage ? 200 : 404,
        headers: PRIVATE_HEADERS,
      });
    } catch {
      return Response.json(
        { error: { code: "unauthenticated" } },
        { status: 401, headers: PRIVATE_HEADERS },
      );
    }
  }
}

import type { SourceRevisionUploadRequest } from "@library/source-sync";
import { SourceRevisionAuthority } from "./authority.js";
import { SourceRevisionAuthorityError, type AuthenticatedPrincipal } from "./contracts.js";

export interface SourceSyncAuthenticator {
  authenticate(request: Request): Promise<AuthenticatedPrincipal>;
}

export class SourceRevisionHttpRouter {
  constructor(private readonly authority: SourceRevisionAuthority, private readonly auth: SourceSyncAuthenticator) {}

  async handle(request: Request): Promise<Response> {
    try {
      if (request.method !== "POST") return json({ error: { code: "method_not_allowed" } }, 405);
      const principal = await this.auth.authenticate(request);
      const path = new URL(request.url).pathname.replace(/\/+$/, "");
      const body = parseUploadRequest(await request.json());
      if (path.endsWith("/source-revisions/uploads")) {
        return json(await this.authority.prepare(principal, body), 200);
      }
      const match = path.match(/\/source-revisions\/uploads\/([^/]+)\/finalize$/);
      if (match?.[1]) return json(await this.authority.finalize(principal, decodeURIComponent(match[1]), body), 200);
      return json({ error: { code: "not_found" } }, 404);
    } catch (error) {
      if (error instanceof SourceRevisionAuthorityError) return json({ error: { code: error.code } }, error.status);
      if (error instanceof SyntaxError) return json({ error: { code: "invalid_json" } }, 400);
      return json({ error: { code: "internal_error" } }, 500);
    }
  }
}

function parseUploadRequest(value: unknown): SourceRevisionUploadRequest {
  if (typeof value !== "object" || value === null) throw new SourceRevisionAuthorityError("invalid_request", 400);
  const item = value as Partial<SourceRevisionUploadRequest>;
  if (typeof item.operationId !== "string" || typeof item.bookId !== "string"
    || !(typeof item.baseRevisionId === "string" || item.baseRevisionId === null)
    || typeof item.sourceName !== "string" || typeof item.deviceId !== "string"
    || typeof item.fingerprint !== "object" || item.fingerprint === null) {
    throw new SourceRevisionAuthorityError("invalid_request", 400);
  }
  return item as SourceRevisionUploadRequest;
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

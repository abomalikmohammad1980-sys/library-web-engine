import { SourceRevisionAuthorityError, type AuthenticatedPrincipal } from "../../source-sync-server/src/index.js";

export interface IdentityVerifier {
  verifyBearer(token: string): Promise<{ kind: "account"; userId: string } | { kind: "guest" } | { kind: "invalid" }>;
}
export function cloudflareAuthenticator(verifier: IdentityVerifier) {
  return { async authenticate(request: Request): Promise<AuthenticatedPrincipal> {
    const header = request.headers.get("authorization") ?? "";
    if (!header.startsWith("Bearer ")) throw new SourceRevisionAuthorityError("unauthenticated", 401);
    const identity = await verifier.verifyBearer(header.slice(7));
    if (identity.kind !== "account" || identity.userId.trim() === "") throw new SourceRevisionAuthorityError("account_required", 401);
    return { userId: identity.userId };
  } };
}

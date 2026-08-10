import { AccountUsageHttpRouter,ConflictResolutionAuthority,ConflictResolutionHttpRouter,DeviceRegistryAuthority,DeviceRegistryHttpRouter,QuarantineResolutionAuthority,RevisionHistoryAuthority, RevisionHistoryHttpRouter, SourceRevisionAuthority, SourceRevisionHttpRouter,UserQuarantineStatusRouter, type DocxInspectionPort } from "../../source-sync-server/src/index.js";
import type { SourceSyncCloudflareEnv } from "./bindings.js";
import { handleStagingPut } from "./staging-grants.js";
import { D1SourceRevisionAuthorityStore } from "./d1-authority-store.js";
import { cloudflareAuthenticator, type IdentityVerifier } from "./identity.js";
import { R2ImmutableSourceObjectStore } from "./r2-source-store.js";
import { WorkerHmacStagingGrantIssuer } from "./staging-grants.js";
import { BuildServiceRouter } from "./build-service-router.js";
import { HmacBuildServiceTokenVerifier } from "./service-auth.js";
import { handleHealthRequest } from "./readiness.js";
import { D1RevisionHistoryStore } from "./d1-revision-history-store.js";
import { oidcVerifierFromBindings } from "./oidc-identity.js";
import { D1DeviceRegistryStore } from "./d1-device-registry.js";
import { D1AccountUsageStore } from "./d1-account-usage.js";
import { maintenanceFromEnv } from "./maintenance.js";
import { docxInspectorFromEnv } from "./docx-inspector.js";
import { D1QuarantineResolutionStore } from "./d1-quarantine.js";
import { QuarantineServiceRouter } from "./quarantine-router.js";
import { VersionKeyInvalidationWorker } from "./cache-invalidation.js";
import { D1UserQuarantineStatusStore } from "./d1-user-quarantine.js";
import { D1ConflictResolutionStore } from "./d1-conflict-resolution-store.js";

export function createSourceSyncWorker(router: SourceRevisionHttpRouter) {
  return { async fetch(request: Request, env: SourceSyncCloudflareEnv): Promise<Response> {
    const health = await handleHealthRequest(request, env); if (health) return health;
    if (new URL(request.url).pathname.endsWith("/build-service/check") || new URL(request.url).pathname.includes("/build-jobs/") || new URL(request.url).pathname.includes("/builds/") || new URL(request.url).pathname.includes("/active-build") || new URL(request.url).pathname.includes("/artifacts/immutable") || new URL(request.url).pathname.includes("/source-revisions/") && new URL(request.url).pathname.endsWith("/bytes")) {
      return new BuildServiceRouter(env.DB, env.SOURCE_OBJECTS, new HmacBuildServiceTokenVerifier(env.BUILD_SERVICE_TOKEN_CURRENT, env.BUILD_SERVICE_TOKEN_PREVIOUS)).handle(request);
    }
    if (request.method === "PUT" && new URL(request.url).pathname.endsWith("/bytes")) {
      return handleStagingPut(request, { bucket: env.SOURCE_OBJECTS, secret: env.SOURCE_UPLOAD_SIGNING_KEY });
    }
    return router.handle(request);
  },async scheduled(_event:unknown,env:SourceSyncCloudflareEnv,ctx?:{waitUntil(p:Promise<unknown>):void}){const work=Promise.all([maintenanceFromEnv(env).run(),invalidationFromEnv(env).run(crypto.randomUUID())]);ctx?.waitUntil(work);if(!ctx)return work} };
}

function isBuildServicePath(request: Request) { const path = new URL(request.url).pathname; return path.endsWith("/build-service/check") || path.includes("/build-jobs/") || path.includes("/builds/") || path.includes("/active-build") || path.includes("/artifacts/immutable") || path.includes("/source-revisions/") && path.endsWith("/bytes"); }

export function createBoundSourceSyncWorker(dependencies: {
  identity?: IdentityVerifier;
  inspection?: DocxInspectionPort;
  ids: { uploadId(): string; revisionId(): string };
}) {
  let boundIdentity=dependencies.identity;
  return { async fetch(request: Request, env: SourceSyncCloudflareEnv): Promise<Response> {
    const health = await handleHealthRequest(request, env); if (health) return health;
    if(new URL(request.url).pathname.includes("/quarantines"))return new QuarantineServiceRouter(new QuarantineResolutionAuthority(new D1QuarantineResolutionStore(env.DB)),new HmacBuildServiceTokenVerifier(env.BUILD_SERVICE_TOKEN_CURRENT,env.BUILD_SERVICE_TOKEN_PREVIOUS,"quarantine-admin")).handle(request);
    if (isBuildServicePath(request)) return new BuildServiceRouter(env.DB, env.SOURCE_OBJECTS, new HmacBuildServiceTokenVerifier(env.BUILD_SERVICE_TOKEN_CURRENT, env.BUILD_SERVICE_TOKEN_PREVIOUS)).handle(request);
    if (request.method === "PUT" && new URL(request.url).pathname.endsWith("/bytes")) {
      return handleStagingPut(request, { bucket: env.SOURCE_OBJECTS, secret: env.SOURCE_UPLOAD_SIGNING_KEY });
    }
    const devices=new D1DeviceRegistryStore(env.DB);const authority = new SourceRevisionAuthority(
      new D1SourceRevisionAuthorityStore(env.DB,new URL(request.url).pathname.includes("/source-revisions/uploads")?quota(env):undefined),
      new R2ImmutableSourceObjectStore(env.SOURCE_OBJECTS),
      new WorkerHmacStagingGrantIssuer(env.SOURCE_SYNC_PUBLIC_BASE_URL, env.SOURCE_UPLOAD_SIGNING_KEY),
      dependencies.inspection??docxInspectorFromEnv(env), dependencies.ids,undefined,devices,
    );
    const authenticator=cloudflareAuthenticator(boundIdentity??=oidcVerifierFromBindings(env));
    if(new URL(request.url).pathname.endsWith("/quarantine-status"))return new UserQuarantineStatusRouter(new D1UserQuarantineStatusStore(env.DB),authenticator).handle(request) as unknown as Promise<Response>;
    if(request.method==="GET"&&new URL(request.url).pathname.endsWith("/account/usage"))return new AccountUsageHttpRouter(new D1AccountUsageStore(env.DB),authenticator).handle(request) as unknown as Promise<Response>;
    if(new URL(request.url).pathname.includes("/devices"))return new DeviceRegistryHttpRouter(new DeviceRegistryAuthority(devices),authenticator).handle(request) as unknown as Promise<Response>;
    if(new URL(request.url).pathname.endsWith("/source-revisions/resolve-conflict"))return new ConflictResolutionHttpRouter(new ConflictResolutionAuthority(new D1ConflictResolutionStore(env.DB),devices),authenticator).handle(request) as unknown as Promise<Response>;
    if(new URL(request.url).pathname.includes("/source-revisions/rollback")||request.method==="GET"&&new URL(request.url).pathname.endsWith("/source-revisions")) return new RevisionHistoryHttpRouter(new RevisionHistoryAuthority(new D1RevisionHistoryStore(env.DB),devices),authenticator).handle(request) as unknown as Promise<Response>;
    return new SourceRevisionHttpRouter(authority, authenticator).handle(request);
  },async scheduled(_event:unknown,env:SourceSyncCloudflareEnv,ctx?:{waitUntil(p:Promise<unknown>):void}){const work=Promise.all([maintenanceFromEnv(env).run(),invalidationFromEnv(env).run(crypto.randomUUID())]);ctx?.waitUntil(work);if(!ctx)return work} };
}
function invalidationFromEnv(e:SourceSyncCloudflareEnv){const batch=Number(e.SYNC_MAINTENANCE_BATCH_SIZE);if(!Number.isSafeInteger(batch)||batch<1||batch>1000)throw Error("maintenance_bindings_invalid");return new VersionKeyInvalidationWorker(e.DB,{batchSize:batch,leaseMs:30_000,baseRetryMs:30_000})}
function quota(e:SourceSyncCloudflareEnv){const keys=["SYNC_MAX_SOURCE_BYTES","SYNC_MAX_BOOK_REVISIONS","SYNC_MAX_ACCOUNT_STORAGE_BYTES","SYNC_MAX_REQUESTS_PER_WINDOW","SYNC_RATE_WINDOW_SECONDS"]as const,values=keys.map(k=>Number(e[k]));if(values.some(x=>!Number.isSafeInteger(x)||x<=0))throw new Error("quota_bindings_missing");return{maxSourceBytes:values[0]!,maxBookRevisions:values[1]!,maxAccountStorageBytes:values[2]!,maxRequestsPerWindow:values[3]!,rateWindowSeconds:values[4]!}}

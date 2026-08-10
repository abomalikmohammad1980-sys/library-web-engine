import type { RegisterSyncDeviceRequest,RevisionHistorySnapshot,SourceRevisionFinalizeResult, SourceRevisionRollbackRequest,SourceRevisionRollbackResult,SourceRevisionUploadPlan, SourceRevisionUploadRequest,SyncAccountUsage,SyncDevice } from "@library/source-sync";
export type { SourceRevisionFinalizeResult, SourceRevisionUploadPlan, SourceRevisionUploadRequest } from "@library/source-sync";

export interface SourceRevisionRemoteApi {
  prepareUpload(request: SourceRevisionUploadRequest): Promise<SourceRevisionUploadPlan>;
  uploadBytes(plan: Extract<SourceRevisionUploadPlan, { kind: "upload" }>, bytes: Uint8Array): Promise<void>;
  finalizeUpload(uploadId: string, request: SourceRevisionUploadRequest): Promise<SourceRevisionFinalizeResult>;
}

export class SourceSyncApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly status: number | null = null,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "SourceSyncApiError";
  }
}

/** HTTP implementation of the server boundary. Ownership is derived by the
 * server from the bearer session; the client never sends an owner identifier. */
export class HttpSourceRevisionApi implements SourceRevisionRemoteApi {
  readonly #baseUrl: URL;
  constructor(
    baseUrl: string | URL,
    private readonly accessToken: () => Promise<string>,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly requestTimeoutMs?: number,
  ) {
    this.#baseUrl = new URL(baseUrl);
  }

  async prepareUpload(request: SourceRevisionUploadRequest): Promise<SourceRevisionUploadPlan> {
    return this.#json<SourceRevisionUploadPlan>("source-revisions/uploads", request);
  }

  async uploadBytes(
    plan: Extract<SourceRevisionUploadPlan, { kind: "upload" }>,
    bytes: Uint8Array,
  ): Promise<void> {
    const response = await this.fetchImpl(plan.uploadUrl, {
      method: "PUT",
      headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      body: bytes,
      ...(this.requestTimeoutMs === undefined ? {} : { signal: AbortSignal.timeout(this.requestTimeoutMs) }),
    });
    if (!response.ok) throw responseError("staging_upload_failed", response);
  }

  async finalizeUpload(
    uploadId: string,
    request: SourceRevisionUploadRequest,
  ): Promise<SourceRevisionFinalizeResult> {
    return this.#json<SourceRevisionFinalizeResult>(
      `source-revisions/uploads/${encodeURIComponent(uploadId)}/finalize`, request,
    );
  }
  revisions(bookId:string){return this.#request<RevisionHistorySnapshot>(`books/${encodeURIComponent(bookId)}/source-revisions`,"GET")}
  devices(){return this.#request<SyncDevice[]>("devices","GET")}
  usage(){return this.#request<SyncAccountUsage>("account/usage","GET")}
  registerDevice(input:RegisterSyncDeviceRequest){return this.#request<SyncDevice>("devices","POST",input)}
  rollback(bookId:string,input:SourceRevisionRollbackRequest){return this.#request<SourceRevisionRollbackResult>(`books/${encodeURIComponent(bookId)}/source-revisions/rollback`,"POST",input)}
  revokeDevice(deviceId:string){return this.#request<{deviceId:string;revoked:true}>(`devices/${encodeURIComponent(deviceId)}/revoke`,"POST",{})}

  async #json<T>(path: string, body: unknown): Promise<T> {
    return this.#request<T>(path,"POST",body);
  }
  async #request<T>(path:string,method:"GET"|"POST",body?:unknown):Promise<T>{
    const token = await this.accessToken();
    if (token.trim() === "") throw new SourceSyncApiError("Missing access token", "unauthenticated", false);
    const response = await this.fetchImpl(new URL(path, this.#baseUrl), {
      method,headers: { authorization: `Bearer ${token}`, ...(body===undefined?{}:{"content-type":"application/json"}) },...(body===undefined?{}:{body:JSON.stringify(body)}),
      ...(this.requestTimeoutMs === undefined ? {} : { signal: AbortSignal.timeout(this.requestTimeoutMs) }),
    });
    if (!response.ok){let code="source_sync_api_failed";try{code=String(((await response.json())as any)?.error?.code??code)}catch{}throw responseError(code,response)}
    return await response.json() as T;
  }
}

function responseError(code: string, response: Response): SourceSyncApiError {
  const safeCode = /^[a-z][a-z0-9_-]{0,63}$/i.test(code) ? code : "source_sync_api_failed";
  const status=response.status;
  return new SourceSyncApiError(safeCode, safeCode, status === 408 || status === 429 || status >= 500, status, parseRetryAfter(response.headers.get("retry-after")));
}

function parseRetryAfter(value:string|null){if(value===null)return null;const seconds=Number(value);if(Number.isFinite(seconds)&&seconds>=0)return Math.round(seconds*1000);const at=Date.parse(value);return Number.isFinite(at)?Math.max(0,at-Date.now()):null}

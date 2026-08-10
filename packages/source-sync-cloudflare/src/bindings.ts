export interface R2ObjectLike { size: number; body: ReadableStream<Uint8Array>; arrayBuffer(): Promise<ArrayBuffer> }
export interface R2BucketBinding {
  head(key: string): Promise<{ size: number } | null>;
  get(key: string): Promise<R2ObjectLike | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | Uint8Array, options?: { onlyIf?: { etagDoesNotMatch?: string }; httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown | null>;
  delete(key: string): Promise<void>;
  list?(options:{prefix:string;cursor?:string;limit?:number}):Promise<{objects:Array<{key:string;uploaded?:Date}>;truncated:boolean;cursor?:string}>;
}
export interface SourceSyncCloudflareEnv {
  DB: D1DatabaseBinding;
  SOURCE_OBJECTS: R2BucketBinding;
  SOURCE_UPLOAD_SIGNING_KEY: string;
  SOURCE_SYNC_PUBLIC_BASE_URL: string;
  BUILD_SERVICE_TOKEN_CURRENT: string;
  BUILD_SERVICE_TOKEN_PREVIOUS?: string;
  OIDC_ISSUER?: string;
  OIDC_AUDIENCE?: string;
  OIDC_JWKS_URL?: string;
  OIDC_ALLOWED_ALGORITHMS?: string;
  SYNC_MAX_SOURCE_BYTES?: string; SYNC_MAX_BOOK_REVISIONS?: string; SYNC_MAX_ACCOUNT_STORAGE_BYTES?: string;
  SYNC_MAX_REQUESTS_PER_WINDOW?: string; SYNC_RATE_WINDOW_SECONDS?: string;
  SYNC_MAINTENANCE_BATCH_SIZE?:string; SYNC_STAGING_GRACE_SECONDS?:string;
  DOCX_MAX_BYTES?:string;DOCX_MAX_ENTRIES?:string;DOCX_MAX_UNCOMPRESSED_BYTES?:string;DOCX_MAX_COMPRESSION_RATIO?:string;
  DOCX_ALLOW_EMBEDDINGS?:string;DOCX_ALLOW_EXTERNAL_RELATIONSHIPS?:string;DOCX_ALLOW_SIGNATURES?:string;
}
export interface D1Result<T = unknown> { success: boolean; meta?: { changes?: number }; results?: T[] }
export interface D1PreparedStatementBinding {
  bind(...values: unknown[]): D1PreparedStatementBinding;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}
export interface D1DatabaseBinding {
  prepare(sql: string): D1PreparedStatementBinding;
  /** Cloudflare D1 executes a batch transactionally: all statements commit or roll back together. */
  batch?<T = unknown>(statements: D1PreparedStatementBinding[]): Promise<D1Result<T>[]>;
}

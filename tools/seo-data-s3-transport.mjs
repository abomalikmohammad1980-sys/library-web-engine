import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import {createHash} from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const CAP = 32 * 1024 ** 2;
const error = (message, transient = false) => Object.assign(new Error(message), { transient });
/** No credential discovery, logging, file I/O, or execution entry point. */
export function createSeoS3Transport({ allowedKeys, endpoint, credentials, signal, requestTimeoutMs = 15000, runTimeoutMs = 1800000, testLoopback = false }) {
  const url = new URL(endpoint);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !(url.protocol === 'https:' && /^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(url.hostname) || testLoopback === true && url.protocol === 'http:' && url.hostname === '127.0.0.1')) throw error('s3_endpoint');
  if (!credentials?.accessKeyId || !credentials?.secretAccessKey || !Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 30000 || !Number.isSafeInteger(runTimeoutMs) || runTimeoutMs < 1 || runTimeoutMs > 3600000) throw error('s3_config');
  const run = new AbortController(), parentAbort = () => run.abort(signal.reason);
  if (signal?.aborted) parentAbort(); else signal?.addEventListener('abort', parentAbort, { once: true });
  const runTimer = setTimeout(() => run.abort(error('s3_run_timeout')), runTimeoutMs); runTimer.unref?.();
  const sdk = new S3Client({ endpoint: url.href, region: 'auto', forcePathStyle: true, maxAttempts: 1, credentials: { ...credentials }, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  const permitted = new Set(allowedKeys);
  if (!permitted.size || [...permitted].some(key => !/^seo\/(identity\/[a-f0-9]{64}\.bin|listings\/[a-f0-9]{64}\/lists-\d{3}\.json|descriptors\/[a-f0-9]{64}\.json)$/.test(key))) throw error('s3_key');
  const checkKey = key => { if (!permitted.has(key)) throw error('s3_key'); };
  const bounded = size => { if (!Number.isSafeInteger(size) || size < 1 || size > CAP) throw error('s3_size'); };
  async function operation(action) {
    run.signal.throwIfAborted(); const controller = new AbortController(), onAbort = () => controller.abort(run.signal.reason);
    run.signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(error('s3_timeout', true)), requestTimeoutMs);
    try { return await action(controller.signal); }
    catch (e) { if (controller.signal.aborted) throw controller.signal.reason; const status = e.$metadata?.httpStatusCode; if (status) throw error(`s3_http_${status}`, status === 408 || status >= 500 && status <= 599); if (e.transient !== undefined) throw e; throw error('s3_network', ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNREFUSED'].includes(e.code)); }
    finally { clearTimeout(timer); run.signal.removeEventListener('abort', onAbort); }
  }
  async function get(key, expectedBytes) {
    checkKey(key); bounded(expectedBytes);
    return operation(async abortSignal => {
      let result;
      try { result = await sdk.send(new GetObjectCommand({ Bucket: 'khzanah-library', Key: key }), { abortSignal }); }
      catch (e) { if (e.$metadata?.httpStatusCode === 404) return null; throw e; }
      const body = result.Body;
      if (!body) throw error('s3_body');
      const abort = () => body.destroy?.(abortSignal.reason); abortSignal.addEventListener('abort', abort, { once: true });
      try {
        abortSignal.throwIfAborted();
        if (result.ContentLength !== undefined && (result.ContentLength > expectedBytes || result.ContentLength > CAP)) throw error('s3_size');
        const chunks = []; let size = 0;
        for await (const chunk of body) { abortSignal.throwIfAborted(); size += chunk.length; if (size > expectedBytes || size > CAP) throw error('s3_size'); chunks.push(chunk); }
        abortSignal.throwIfAborted(); if (size !== expectedBytes) throw error('s3_size'); return Buffer.concat(chunks, size);
      } finally { abortSignal.removeEventListener('abort', abort); body.destroy?.(); }
    });
  }
  async function put(key, input, condition) {
    checkKey(key); bounded(input?.length); if (condition?.ifNoneMatch !== '*') throw error('s3_condition'); const body = Buffer.from(input); bounded(body.length);
    try { await operation(async abortSignal => { await sdk.send(new PutObjectCommand({ Bucket: 'khzanah-library', Key: key, Body: body, ContentLength: body.length, ContentType: key.endsWith('.bin') ? 'application/octet-stream' : 'application/json; charset=utf-8', CacheControl: 'public, max-age=31536000, immutable', IfNoneMatch: '*' }), { abortSignal }); }); }
    catch (e) { if (e.message !== 's3_http_412') throw e; const existing = await get(key, body.length); if (!existing || sha(existing) !== sha(body)) throw error('immutable_remote_mismatch'); }
  }
  return { get, put, close() { clearTimeout(runTimer); signal?.removeEventListener('abort', parentAbort); run.abort(error('s3_closed')); sdk.destroy(); } };
}

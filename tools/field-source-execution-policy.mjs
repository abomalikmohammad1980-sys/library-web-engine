/** Transfer remains tightly bounded; independent public reads need no S3 access. */
export function fieldSourceExecutionPolicy(fresh) {
  return Object.freeze({ workers: fresh ? 4 : 2, runTimeoutMs: fresh ? 3 * 3600000 : 3600000, needsWriteTransport: !fresh })
}

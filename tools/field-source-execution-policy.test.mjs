import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fieldSourceExecutionPolicy } from './field-source-execution-policy.mjs'
test('independent canonical verification is bounded and has no credential transport', () => {
  assert.deepEqual(fieldSourceExecutionPolicy(true), { workers: 4, runTimeoutMs: 10800000, needsWriteTransport: false })
})
test('does not broaden the immutable upload worker or duration budget', () => {
  assert.deepEqual(fieldSourceExecutionPolicy(false), { workers: 2, runTimeoutMs: 3600000, needsWriteTransport: true })
})

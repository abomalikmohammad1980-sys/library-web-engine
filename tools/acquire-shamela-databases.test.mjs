import assert from 'node:assert/strict'
import test from 'node:test'
import { HELP, parseAcquireArgs } from './acquire-shamela-databases.mjs'

test('parses the bounded golden sample without network access', () => {
  assert.deepEqual(parseAcquireArgs(['local-output', '--golden', '12']), {
    help: false, outputDirectory: 'local-output', goldenBookCount: 12,
  })
  assert.deepEqual(parseAcquireArgs(['--golden', '1']), {
    help: false, outputDirectory: undefined, goldenBookCount: 1,
  })
  assert.deepEqual(parseAcquireArgs(['--golden', '100', 'local-output']), {
    help: false, outputDirectory: 'local-output', goldenBookCount: 100,
  })
})

test('rejects invalid or ambiguous arguments before acquisition', () => {
  for (const args of [['--golden', '0'], ['--golden', '101'], ['--golden', '1.5'], ['--golden'], ['--unknown']]) {
    assert.throws(() => parseAcquireArgs(args))
  }
  assert.throws(() => parseAcquireArgs(['one', 'two']), /output_directory_repeated/)
  assert.throws(() => parseAcquireArgs(['--golden', '2', '--golden', '3']), /golden_option_repeated/)
})

test('help documents the bounded sample and its independent manifest', () => {
  assert.match(HELP, /--golden <1\.\.100>/)
  assert.match(HELP, /manifest\.golden-sample\.json/)
  assert.match(HELP, /inside the project root/)
})

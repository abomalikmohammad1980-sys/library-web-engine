import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve, dirname, basename } from 'node:path'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { assetPath, digest, restorePublicAssets } from './restore-public-assets.mjs'

test('rejects absolute paths, traversal, Windows separators and unrelated files', () => {
  const root = resolve('.')
  for (const path of ['../app/public/x', '/app/public/x', 'app/public/../x', 'app/public//x',
    'app/public/./x', 'app/public\\x', 'app/public/x:stream', '.env', 'deployment/wrangler.toml', 'C:/tmp/x']) {
    assert.throws(() => assetPath(root, path), /ci_asset_path_invalid/)
  }
  assert.equal(assetPath(root, 'app/public/data/fixture.json'), resolve(root, 'app/public/data/fixture.json'))
})

test('rejects a corrupt archive before unpacking or writing the checkout', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'khizana-ci-test-'))
  try {
    const archive = resolve(directory, 'bad.tar.gz')
    await writeFile(archive, 'abc')
    assert.equal(await digest(archive), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    await assert.rejects(restorePublicAssets(directory, archive), /ci_archive_integrity/)
  } finally {
    assert.equal(dirname(directory), resolve(tmpdir()))
    assert.ok(basename(directory).startsWith('khizana-ci-test-'))
    await rm(directory, { recursive: true, force: true })
  }
})

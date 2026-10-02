import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { copyFile, lstat, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { dirname, resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { pipeline } from 'node:stream/promises'
import { execFileSync } from 'node:child_process'

export function assetPath(root, name) {
  if (!/^(app\/public\/|artifacts\/heading-search-central-v2\/)/.test(name)
      || /[\\:\x00-\x1f]/.test(name) || name.split('/').some(part => !part || part === '.' || part === '..')) {
    throw Error('ci_asset_path_invalid')
  }
  const target = resolve(root, name), rel = relative(root, target)
  if (isAbsolute(rel) || rel.startsWith('..')) throw Error('ci_asset_path_invalid')
  return target
}

export async function digest(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

async function verifiedFile(root, entry) {
  const file = assetPath(root, entry.path)
  // Reject symlink parents too; a fixture may never redirect writes outside the checkout.
  for (let current = file; current !== root; current = dirname(current)) {
    try {
      if ((await lstat(current)).isSymbolicLink()) throw Error('ci_asset_symlink')
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  const stat = await lstat(file)
  if (!stat.isFile() || stat.size !== entry.bytes || await digest(file) !== entry.sha256) {
    throw Error('ci_asset_integrity: ' + entry.path)
  }
  return file
}

export async function restorePublicAssets(root, archiveOverride) {
  root = resolve(root)
  const config = JSON.parse(await readFile(new URL('./public-assets.json', import.meta.url)))
  const entries = JSON.parse(await readFile(new URL('./public-assets.files.json', import.meta.url)))
  for (const entry of entries) assetPath(root, entry.path)
  const temporary = await mkdtemp(resolve(tmpdir(), 'khizana-ci-assets-'))
  try {
    const archive = archiveOverride ? resolve(archiveOverride) : resolve(temporary, 'assets.tar.gz')
    if (!archiveOverride) {
      const response = await fetch(config.url, { signal: AbortSignal.timeout(600_000) })
      if (!response.ok || !response.body) throw Error('ci_asset_download: ' + response.status)
      await pipeline(response.body, createWriteStream(archive))
    }
    if ((await lstat(archive)).size !== config.bytes || await digest(archive) !== config.sha256) {
      throw Error('ci_archive_integrity')
    }
    const names = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
      .trimEnd().split(/\r?\n/)
    const allowed = new Set(entries.map(entry => entry.path))
    if (allowed.size !== entries.length || names.length !== entries.length || new Set(names).size !== names.length
        || names.some(name => !allowed.has(name))) throw Error('ci_archive_inventory')
    const extracted = resolve(temporary, 'extracted')
    await mkdir(extracted)
    execFileSync('tar', ['-xzf', archive, '-C', extracted])
    // Verify every payload before changing the checkout. Never overwrite a differing file.
    for (const entry of entries) {
      await verifiedFile(extracted, entry)
      try { await verifiedFile(root, entry) }
      catch (error) { if (error.code !== 'ENOENT') throw error }
    }
    for (const entry of entries) {
      const destination = assetPath(root, entry.path)
      await mkdir(dirname(destination), { recursive: true })
      await copyFile(assetPath(extracted, entry.path), destination)
    }
    console.log(`Verified and restored ${entries.length} pinned public build/test assets.`)
  } finally {
    // This directory was returned by mkdtemp in this invocation; no user path is removed.
    const insideTemp = relative(resolve(tmpdir()), temporary)
    if (isAbsolute(insideTemp) || insideTemp.startsWith('..') || !insideTemp.startsWith('khizana-ci-assets-')) {
      throw Error('ci_asset_cleanup_path')
    }
    await rm(temporary, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await restorePublicAssets(resolve(dirname(fileURLToPath(import.meta.url)), '../..'), process.argv[2])
}

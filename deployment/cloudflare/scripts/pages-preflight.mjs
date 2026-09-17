import { execFile } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { verifyRelease } from './release-integrity.mjs'
import { parseWranglerAuthentication, validatePagesConfig } from './pages-preflight-lib.mjs'

const exec = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const config = validatePagesConfig(await readFile(resolve(root, 'wrangler.toml'), 'utf8'))
const artifact = await verifyRelease({ pagesDirectory: resolve(root, 'pages-dist'), releasesDirectory: resolve(root, 'release-artifacts') })
const wrangler = resolve(root, 'node_modules/wrangler/bin/wrangler.js')
let stdout = '', stderr = ''
try {
  const result = await exec(process.execPath, [wrangler, 'whoami'], { cwd: root, env: process.env })
  stdout = result.stdout; stderr = result.stderr
} catch (error) {
  stdout = error.stdout ?? ''; stderr = error.stderr ?? ''
}
const auth = parseWranglerAuthentication(stdout, stderr)
console.log(JSON.stringify({ project: config.name, output: config.output, candidate: artifact.payload.fingerprint, files: artifact.deployed.fileCount, authenticated: auth.authenticated, blocker: auth.blocker ?? null }, null, 2))
if (!auth.authenticated) process.exitCode = 2

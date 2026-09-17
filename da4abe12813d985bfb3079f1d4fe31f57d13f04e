#!/usr/bin/env node
import { resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const engineRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const projectRoot = resolve(engineRoot, '..', '..')
const defaultRoot = resolve(projectRoot, 'بيانات-المشروع', 'shamela', '1448.2', 'selective')

export const HELP = `Usage:
  node tools/acquire-shamela-databases.mjs [output-directory] [--golden <1..100>]

Options:
  --golden <1..100>  Download a small deterministic book sample plus available
                     master/service SQLite databases. It resumes from the
                     independent manifest.golden-sample.json manifest.
  -h, --help         Show this help without accessing the network.

The output directory defaults to a portable path under the project root:
  بيانات-المشروع/shamela/1448.2/selective
All output must remain inside the project root.`

export function parseAcquireArgs(args) {
  let outputDirectory
  let goldenBookCount
  let help = false
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === '-h' || arg === '--help') { help = true; continue }
    if (arg === '--golden') {
      if (goldenBookCount !== undefined) throw new Error('shamela_golden_option_repeated')
      const value = args[++index]
      if (!value || !/^(?:[1-9]|[1-9][0-9]|100)$/.test(value)) throw new Error('shamela_golden_must_be_1_to_100')
      goldenBookCount = Number(value)
      continue
    }
    if (arg.startsWith('-')) throw new Error(`shamela_unknown_option:${arg}`)
    if (outputDirectory !== undefined) throw new Error('shamela_output_directory_repeated')
    outputDirectory = arg
  }
  return { help, outputDirectory, goldenBookCount }
}

export async function main(args = process.argv.slice(2)) {
  const parsed = parseAcquireArgs(args)
  if (parsed.help) { process.stdout.write(`${HELP}\n`); return }
  const requestedRoot = resolve(parsed.outputDirectory ?? defaultRoot)
  const rel = relative(projectRoot, requestedRoot)

  if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) {
    throw new Error('shamela_acquisition_root_must_be_inside_project')
  }

  const [{ acquireShamelaDatabases }, { SHAMELA_OFFICIAL_1448_2 }] = await Promise.all([
    import('../packages/source-sync-node/dist/index.js'),
    import('../packages/source-sync/dist/index.js'),
  ])
  const manifest = await acquireShamelaDatabases({
    root: requestedRoot,
    release: SHAMELA_OFFICIAL_1448_2,
    ...(parsed.goldenBookCount === undefined ? {} : { goldenSample: { bookCount: parsed.goldenBookCount } }),
    onProgress(completed, total, path) {
      process.stdout.write(`${completed}/${total}\t${path}\n`)
    },
  })

  process.stdout.write(`${JSON.stringify({ root: requestedRoot, ...manifest }, null, 2)}\n`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()

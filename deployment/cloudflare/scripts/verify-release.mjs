import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyRelease } from './release-integrity.mjs'
import {readFile,readdir} from 'node:fs/promises'
import {verifyNextRelease} from './next-release-gate.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const acceptance=JSON.parse(await readFile(resolve(root,'ops/next-release-candidate.json'),'utf8'))
await verifyNextRelease({root,candidate:acceptance})
const migrations=(await readdir(resolve(root,'migrations'))).filter(name=>/^\d{4}_.+\.sql$/.test(name)).map(name=>`migrations/${name}`).sort()
if(JSON.stringify(acceptance.components.migrations.files.map(file=>file.path).sort())!==JSON.stringify(migrations))throw Error('next_release_migrations_incomplete')
if(!acceptance.components.helper.files.some(file=>file.path==='pages-dist/downloads/khizana-word-companion-windows.zip'))throw Error('next_release_helper_not_bound')
if(!acceptance.components.data.files.some(file=>/^pages-dist\/(?:data|library)\//.test(file.path)))throw Error('next_release_data_not_bound')
const result = await verifyRelease({ pagesDirectory: resolve(root, 'pages-dist'), releasesDirectory: resolve(root, 'release-artifacts') })
if(!acceptance.components.code.files.some(file=>file.path==='pages-dist/q13-manifest.json'))throw Error('next_release_pages_manifest_not_bound')
if(result.previous.fingerprint!==acceptance.previous.deployFingerprint)throw Error('next_release_previous_pointer_changed')
console.log(`Release drift gate passed: ${result.deployed.fileCount} files, candidate ${result.payload.fingerprint}, previous ${result.previous.fingerprint}, works ${result.publication.ready}, Word ${result.publication.wordSources} = ${result.publication.wordMaps} maps + ${result.publication.wordFallbacks} fallbacks`)

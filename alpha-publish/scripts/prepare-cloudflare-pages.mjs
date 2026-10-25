import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import {prepareAndroidAssetlinks,assetlinksHeaders} from '../../tools/android-assetlinks.mjs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import {satelliteCspSources} from './satellite-build-config.mjs'
import {stampServiceWorkerRelease,assertServiceWorkerRelease} from './service-worker-release.mjs'
import {prepareSeoIndex} from '../../tools/prepare-seo-index.mjs'
import {inlineThemeBootstrap} from '../../tools/inline-theme-bootstrap.mjs'
import {inlineRoutePreloads} from '../../tools/route-preload-hints.mjs'

const root = resolve(import.meta.dirname, '..')
const isolatedStageRoot=resolve(root,'../.artifacts')
function isolatedPath(value){const path=resolve(value),rel=relative(isolatedStageRoot,path);if(!rel||rel==='..'||rel.startsWith(`..${sep}`)||isAbsolute(rel))throw Error('isolated_stage_path_outside_artifacts');return path}
const source = process.env.KHIZANA_STAGE_PUBLIC?isolatedPath(process.env.KHIZANA_STAGE_PUBLIC):resolve(root, 'public/khizana')
const output = process.env.KHIZANA_STAGE_PAGES_DIST?isolatedPath(process.env.KHIZANA_STAGE_PAGES_DIST):resolve(root, 'pages-dist')

await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
await cp(source, output, { recursive: true })

const index = await readFile(resolve(output, 'index.html'), 'utf8')
if (!index.includes('الخِزانة') || !index.includes('type="module"')) throw new Error('Cloudflare Pages source is not the verified app bundle')
const worker=stampServiceWorkerRelease(await readFile(resolve(output,'sw.js'),'utf8'),index)
assertServiceWorkerRelease(worker,index)
await writeFile(resolve(output,'sw.js'),worker,'utf8')
const satelliteCsp=satelliteCspSources(index)
let readerConnectSource=''
try{
  const client=JSON.parse(await readFile(resolve(output,'data/shamela-pages-release.json'),'utf8'))
  if(client.directReaderShards){
    const project=client.projects?.find(item=>item.name===client.directReaderShards.project&&item.group==='corpus')
    const url=new URL(project?.baseUrl)
    if(url.protocol!=='https:'||! /^(?:[a-z0-9-]+\.)?khezana-reader-01\.pages\.dev$/u.test(url.hostname))throw Error('reader_asset_origin_invalid')
    readerConnectSource=` ${url.origin}`
  }
}catch(error){if(error?.code!=='ENOENT')throw error}
// Only the official embeddable map endpoint; no broad external frame access.
const mapFrameSources = "'self' https://www.openstreetmap.org/export/embed.html https://www.google.com/maps/embed/"

await writeFile(resolve(output, '_headers'), `/*
  X-Robots-Tag: noindex
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: SAMEORIGIN
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; frame-src ${mapFrameSources}; form-action 'self'; script-src 'self' 'wasm-unsafe-eval'${satelliteCsp.script}; style-src 'self' 'unsafe-inline'${satelliteCsp.style}; img-src 'self' data: blob:${satelliteCsp.img}; font-src 'self' data:; connect-src 'self' http://localhost:43129${readerConnectSource}; media-src 'self' blob: https://*.mp3quran.net https://cdn.quranpedia.net https://wikiquran.nyc3.digitaloceanspaces.com; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-store, max-age=0, must-revalidate

/index.html
  Cache-Control: no-cache, max-age=0, must-revalidate

/manifest.webmanifest
  Cache-Control: no-cache, max-age=0, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/quran/*
  Cache-Control: public, max-age=86400
`, 'utf8')
await writeFile(resolve(output,'_headers'),(await readFile(resolve(output,'_headers'),'utf8'))+assetlinksHeaders,'utf8')
const prepaint = inlineThemeBootstrap(index, await readFile(resolve(output,'_headers'),'utf8'), await readFile(resolve(output,'theme-init.js'),'utf8'))
const hints = await readFile(resolve(output,'route-preload-hints.json'),'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error})
if(hints)Object.assign(prepaint,inlineRoutePreloads(prepaint.index,prepaint.headers,JSON.parse(hints)))
await writeFile(resolve(output,'index.html'),prepaint.index)
await writeFile(resolve(output,'_headers'),prepaint.headers)
await writeFile(resolve(output,'sw.js'),stampServiceWorkerRelease(worker,prepaint.index))
await cp(resolve(root,'scripts/pages-static/_redirects'),resolve(output,'_redirects'))
await cp(resolve(root,'scripts/pages-static/404.html'),resolve(output,'404.html'))
await cp(resolve(root,'scripts/pages-static/_routes.json'),resolve(output,'_routes.json'))
await prepareAndroidAssetlinks(output)
await prepareSeoIndex(output)

console.log('Cloudflare Pages artifact ready: pages-dist')

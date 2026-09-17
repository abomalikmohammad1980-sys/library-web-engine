// Local-only finalization; never activates remote pointers or deploys.
import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {inventory} from '../alpha-publish/scripts/release-integrity.mjs'
import {readSeoListing} from '../alpha-publish/functions/_seo-listings.js'
const root=resolve(import.meta.dirname,'..'),base=resolve(root,'.artifacts/batch37'),out=resolve(base,'deploy/pages-dist')
const stage=JSON.parse(await readFile(resolve(base,'stage.json')))
assert.equal(stage.published,false);assert(!stage.seoPreview,'already_finalized')
assert.equal((await inventory(out)).fingerprint,stage.deployFingerprint)
assert.equal((await inventory(resolve(base,'deploy/functions'))).fingerprint,stage.functionsFingerprint)
const pack=resolve(root,'.artifacts/seo-data-stage-a-20260917-v1')
const descriptor=await readFile(resolve(pack,'descriptor.json')),sha=createHash('sha256').update(descriptor).digest('hex'),data=JSON.parse(descriptor)
assert.equal(sha,'3c6c99ea80fb2f3b723a5c32a5b0eafdb8cbb4c930fcf8172e96c4c27f827d4c')
await writeFile(resolve(out,'data/seo/release.json'),descriptor,{flag:'wx'})
const bucket={get:async key=>{const bytes=await readFile(resolve(pack,'objects',key));return{size:bytes.length,body:new Response(bytes).body}}}
const categories=await readSeoListing(null,'https://khzanah.com','categories',1,{bucket,releaseId:data.listings.releaseId})
assert.equal(categories.pages,1);assert.equal(categories.total,40)
const date=data.identities.generatedAt,loc=path=>`<url><loc>https://khzanah.com${path}</loc><lastmod>${date}</lastmod></url>`
await writeFile(resolve(out,'sitemap-categories.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+categories.rows.map(row=>loc(row.href)).join('')+'</urlset>',{flag:'wx'})
let staticXml=await readFile(resolve(out,'sitemap-static.xml'),'utf8')
assert(!staticXml.includes('https://khzanah.com/categories'))
await writeFile(resolve(out,'sitemap-static.xml'),staticXml.replace('</urlset>',loc('/categories')+'</urlset>'))
let sitemap=await readFile(resolve(out,'sitemap.xml'),'utf8')
assert(!sitemap.includes('sitemap-categories.xml'))
await writeFile(resolve(out,'sitemap.xml'),sitemap.replace('</sitemapindex>',`<sitemap><loc>https://khzanah.com/sitemap-categories.xml</loc><lastmod>${date}</lastmod></sitemap></sitemapindex>`))
// This candidate is preview-only. No production database, Access audience, AI,
// or ingestion activation is carried into its configuration.
const version=stage.functionsFingerprint
await writeFile(resolve(base,'deploy/wrangler.toml'),`name = "khezana"
pages_build_output_dir = "./pages-dist"
compatibility_date = "2026-08-09"
[vars]
SEO_DATA_RELEASE_SHA256 = "${sha}"
SEO_HTML_CACHE_VERSION = "${version}"
HEADING_QUERY_ENABLED = "0"
[[r2_buckets]]
binding = "LIBRARY_R2"
bucket_name = "khzanah-library"
[[d1_databases]]
binding = "VISITORS_DB"
database_name = "khizana-bok-acceptance-20260917"
database_id = "9133fe99-c4e1-4a1e-84f3-127735883279"
`)
const payload=await inventory(out,{exclude:new Set(['q13-manifest.json'])})
await writeFile(resolve(out,'q13-manifest.json'),JSON.stringify({schemaVersion:1,...payload},null,2))
const final=await inventory(out);assert(final.fileCount<=20000,'pages_asset_budget')
Object.assign(stage,{payloadFingerprint:payload.fingerprint,deployFingerprint:final.fingerprint,files:final.fileCount,seoPreview:{descriptorSha256:sha,cacheVersion:version,categories:40,remoteVerified:false},acceptanceRequired:['fresh verify all515 SEO R2 objects','isolated preview HTML + UI +30URL p95'],productionReady:false})
await writeFile(resolve(base,'stage.json'),JSON.stringify(stage,null,2))
console.log(JSON.stringify(stage))

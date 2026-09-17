import test from 'node:test'
import assert from 'node:assert/strict'
import {publicSitemap,publicSitemapPages} from '../alpha-publish/functions/_seo-public-sitemap.js'
test('public sitemap uses approved visible books only, paginates and excludes previews from indexing',async()=>{
 const db={prepare(sql){assert.match(sql,/visibility='public'/);assert.match(sql,/review_status='approved'/);assert.match(sql,/deleted_at IS NULL/);assert.match(sql,/central_book_overrides/);return {first:async()=>({count:5001}),bind(offset){assert.equal(offset,5000);return{all:async()=>({results:[{id:'book-1',updated_at:'2026-09-16'}]})}}}}}
 assert.equal(await publicSitemapPages(db),2)
 const response=await publicSitemap(db,new URL('https://preview.pages.dev/sitemap-public.xml?page=2'))
 assert.equal(response.headers.get('x-robots-tag'),'noindex')
 assert.match(await response.text(),/https:\/\/khzanah.com\/books\/public\/book-1/)
 assert.equal((await publicSitemap(db,new URL('https://khzanah.com/sitemap-public.xml?page=-1'))).status,400)
})

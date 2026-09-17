import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
test('candidate configuration pins the proven release and uses the preview origin',()=>{
 const target={__SHAMELA_SEARCH_V2_PACKED__:{existing:true}}
 runInNewContext(readFileSync(new URL('./batch35-search-candidate-config.js',import.meta.url),'utf8'),{globalThis:target,location:{origin:'https://preview.example.test'}})
 const value=target.__KHIZANA_SEARCH_FIELDS__
 assert.equal(value.manifestUrl,`https://preview.example.test/library/search-fields/${value.manifestSha256}/manifest.json`)
 assert.equal(value.manifestSha256,'a81347caaabbdb907b29fe2b4f8309be801c47d41cd051cc99c438e043eb1613')
 assert.equal(value.packedManifestSha256,'b1815eeec97468f791b5a155f43b4f9d85f2d783926d0162bef896397b03f54b')
 assert.equal(value.expectedBooks,8594);assert.equal(value.expectedSegments,860);assert.ok(Object.isFrozen(value))
 assert.deepEqual(target.__SHAMELA_SEARCH_V2_PACKED__,{existing:true});assert.equal(target.__PUBLIC_BOOK_SEARCH_ENABLED__,undefined)
})

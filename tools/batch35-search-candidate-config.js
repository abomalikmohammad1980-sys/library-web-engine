// Candidate-only configuration. Do not include in production until all remote
// field assets pass fresh verification and the combined release passes review.
globalThis.__KHIZANA_SEARCH_FIELDS__=Object.freeze({
 complete:true,
 manifestUrl:location.origin+'/library/search-fields/a81347caaabbdb907b29fe2b4f8309be801c47d41cd051cc99c438e043eb1613/manifest.json',
 manifestSha256:'a81347caaabbdb907b29fe2b4f8309be801c47d41cd051cc99c438e043eb1613',
 sourceIndexSha256:'a88f1f13ac8f8fd62162b1fa631fd7652874408ac639ab7976984eb034b73381',
 packedManifestSha256:'b1815eeec97468f791b5a155f43b4f9d85f2d783926d0162bef896397b03f54b',
 packedReleaseId:'shamela-search-v2-packed-a88f1f13ac8f8fd6-p8-l26213376-t1-r1',
 expectedBooks:8594,
 expectedSegments:860,
})
// The independent public-upload consumer needs server PUBLIC_BOOK_SEARCH_ENABLED
// and ingestion acceptance as well. Leave it disabled unless root enables both.

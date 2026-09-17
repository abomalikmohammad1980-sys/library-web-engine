import assert from 'node:assert/strict'
const base='https://seo-indexing-preview.khezana.pages.dev'
for(const [path,status,target] of [['/books/21633',200],['/authors/000020',200],['/quran',200],['/this-does-not-exist-xyz',404],['/books/999999999',404],['/settings',200],['/books/shamela-21633?pageIndex=4',301,'/books/21633?pageIndex=4'],['/reader/410021633',301,'/books/21633'],['/people/000020',301,'/authors/000020'],['/author/20',301,'/authors/000020'],['/sitemap.xml',200]]){
 const response=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(30000)})
 const html=await response.text()
 assert.equal(response.status,status,path)
 if(target)assert.equal(response.headers.get('location'),base+target)
 assert.match(response.headers.get('x-robots-tag')??'',/noindex/,path)
 if(path==='/quran')assert.match(html,/<h1>القرآن الكريم<\/h1>/)
 if(path==='/books/21633'){
  const description=html.match(/<meta name="description" content="([^"]*)"/)?.[1]
  assert(description);assert.doesNotMatch(description,/تأليف أب[وي]|كتب كتب/);assert(description.length<=155)
 }
 console.log(JSON.stringify({path,status:response.status,location:response.headers.get('location'),noindex:true}))
}

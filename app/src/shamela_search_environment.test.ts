import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {packedSearchConfigAllowedOnHost,searchV2BucketFor,ShamelaSearchV2Client} from './shamela_search_v2'

describe('Shamela packed search environment selection',()=>{
  it('discovers the local eight-origin Range harness without requiring an injected production config',()=>{
    const source=readFileSync(new URL('./shamela_search_v2.ts',import.meta.url),'utf8')
    expect(source).toContain("controlBaseUrl:'http://127.0.0.1:4200/control'")
    expect(source).toContain('4200+index')
  })
  const production={controlBaseUrl:'https://khezana-search-v2-00.pages.dev/control',projectBaseUrls:['https://khezana-search-v2-00.pages.dev']}
  const harness={controlBaseUrl:'http://127.0.0.1:4200/control',projectBaseUrls:['http://127.0.0.1:4200']}
  it('ignores production packed origins on localhost',()=>expect(packedSearchConfigAllowedOnHost(production,'localhost')).toBe(false))
  it('bounds the optional local packed manifest probe so offline helpers cannot hold the UI',()=>{
    const source=readFileSync(new URL('./shamela_search_v2.ts',import.meta.url),'utf8')
    expect(source).toContain('localHost?{signal:AbortSignal.timeout(2_000)}:undefined')
    expect(source).toContain("globalThis.location?.hostname==='[::1]'")
  })
  it('allows an explicit localhost harness',()=>expect(packedSearchConfigAllowedOnHost(harness,'127.0.0.1')).toBe(true))
  it('allows production packed origins on a deployed host',()=>expect(packedSearchConfigAllowedOnHost(production,'alkhizana.pages.dev')).toBe(true))
  it('uses the manifest bucket cardinality to match four-digit snippets and five-digit global postings',()=>{expect(searchV2BucketFor('x',512)).toMatch(/^\d{4}$/);expect(searchV2BucketFor('x',32768)).toMatch(/^\d{5}$/)})
  it('falls back to the unpacked local index when the optional packed harness is offline',async()=>{
    const previousLocation=Object.getOwnPropertyDescriptor(globalThis,'location')
    const previousConfig=(globalThis as typeof globalThis&{__SHAMELA_SEARCH_V2_PACKED__?:unknown}).__SHAMELA_SEARCH_V2_PACKED__
    Object.defineProperty(globalThis,'location',{configurable:true,value:{hostname:'127.0.0.1'}})
    ;(globalThis as typeof globalThis&{__SHAMELA_SEARCH_V2_PACKED__?:unknown}).__SHAMELA_SEARCH_V2_PACKED__=harness
    const calls:string[]=[]
    const fetcher=async(input:RequestInfo|URL)=>{
      const url=String(input);calls.push(url)
      if(url.startsWith('http://127.0.0.1:4200'))throw new TypeError('Failed to fetch')
      if(url.endsWith('/library/shamela-search-v2/manifest.json'))return new Response(JSON.stringify({contract:'shamela-search-v2/manifest-3',coverageComplete:true,counts:{books:8594},bucketCount:512,routePattern:'routing/{bucket}.json'}),{headers:{'content-type':'application/json'}})
      return new Response(null,{status:404})
    }
    try{
      const page=await new ShamelaSearchV2Client(fetcher as typeof fetch).search('',0,40)
      expect(page).toMatchObject({total:0,indexedBooks:8594})
      expect(calls.some(url=>url.startsWith('http://127.0.0.1:4200'))).toBe(true)
      expect(calls.some(url=>url.endsWith('/library/shamela-search-v2/manifest.json'))).toBe(true)
    }finally{
      if(previousLocation)Object.defineProperty(globalThis,'location',previousLocation);else Reflect.deleteProperty(globalThis,'location')
      if(previousConfig===undefined)delete (globalThis as typeof globalThis&{__SHAMELA_SEARCH_V2_PACKED__?:unknown}).__SHAMELA_SEARCH_V2_PACKED__
      else (globalThis as typeof globalThis&{__SHAMELA_SEARCH_V2_PACKED__?:unknown}).__SHAMELA_SEARCH_V2_PACKED__=previousConfig
    }
  })
  it('cancels an ignored Range response before reading the archive and falls back to the selective shard',async()=>{
    const previousLocation=Object.getOwnPropertyDescriptor(globalThis,'location')
    const previousConfig=(globalThis as typeof globalThis&{__SHAMELA_SEARCH_V2_PACKED__?:unknown}).__SHAMELA_SEARCH_V2_PACKED__
    Object.defineProperty(globalThis,'location',{configurable:true,value:{hostname:'127.0.0.1'}})
    ;(globalThis as typeof globalThis&{__SHAMELA_SEARCH_V2_PACKED__?:unknown}).__SHAMELA_SEARCH_V2_PACKED__=harness
    const word='سلعة',postingPath=`postings/${searchV2BucketFor(word,16)}.json`,calls:string[]=[]
    let archiveCancelled=false
    const fetcher=async(input:RequestInfo|URL)=>{
      const url=String(input);calls.push(url)
      if(url.endsWith('/control/manifest.json'))return new Response(JSON.stringify({contract:'shamela-search-v2/packed-manifest-1',coverageComplete:true,counts:{segments:1,expectedSegments:1,books:1,documents:1,positions:1},indexBucketCount:1,indexPattern:'index/{bucket}.json',source:{postingBucketCount:16,postingPattern:'postings/{bucket}.json',segmentSnippetPattern:'segments/{segment}/snippets/{bucket}.json',bucketCount:16}}))
      if(url.includes('/control/index/'))return new Response(JSON.stringify({entries:[[postingPath,{byteLength:2,sha256:'x',parts:[{archive:'huge',project:0,offset:10,length:2,sha256:'x'}]}]]}))
      if(new URL(url,'http://127.0.0.1').pathname.endsWith('/archives/huge.bin')){
        const body=new ReadableStream({cancel(){archiveCancelled=true}})
        return new Response(body,{status:200,headers:{'content-length':'700000000'}})
      }
      if(url.endsWith(`/library/shamela-search-v2/${postingPath}`))return new Response(JSON.stringify({entries:[[word,[]]]}),{headers:{'content-type':'application/json'}})
      return new Response(null,{status:404})
    }
    try{
      const client=new ShamelaSearchV2Client(fetcher as typeof fetch),page=await client.search(word,0,40)
      expect(page.total).toBe(0)
      expect(archiveCancelled).toBe(true)
      expect(client.bytesFetched).toBeLessThan(10_000)
      expect(calls.some(url=>url.endsWith(`/library/shamela-search-v2/${postingPath}`))).toBe(true)
    }finally{
      if(previousLocation)Object.defineProperty(globalThis,'location',previousLocation);else Reflect.deleteProperty(globalThis,'location')
      if(previousConfig===undefined)delete (globalThis as typeof globalThis&{__SHAMELA_SEARCH_V2_PACKED__?:unknown}).__SHAMELA_SEARCH_V2_PACKED__
      else (globalThis as typeof globalThis&{__SHAMELA_SEARCH_V2_PACKED__?:unknown}).__SHAMELA_SEARCH_V2_PACKED__=previousConfig
    }
  })
  it('uses the smallest posting as an anchor and verifies exact occurrences from candidate snippets',async()=>{
    const previousLocation=Object.getOwnPropertyDescriptor(globalThis,'location'),previousConfig=(globalThis as typeof globalThis&{__SHAMELA_SEARCH_V2_PACKED__?:unknown}).__SHAMELA_SEARCH_V2_PACKED__
    Object.defineProperty(globalThis,'location',{configurable:true,value:{hostname:'127.0.0.1'}});(globalThis as typeof globalThis&{__SHAMELA_SEARCH_V2_PACKED__?:unknown}).__SHAMELA_SEARCH_V2_PACKED__=harness
    const words=['الا','ان','سلعة','الله'],paths=words.map(word=>`postings/${searchV2BucketFor(word,16)}.json`),id='10:7',segment='s1',snippetPath=`segments/${segment}/snippets/${searchV2BucketFor(id,16)}.json`,entries=[...paths.map((path,index)=>[path,{byteLength:index===2?100:100_000_000,sha256:'x',parts:[{archive:'ignored',project:0,offset:0,length:1,sha256:'x'}]}]),[snippetPath,{byteLength:200,sha256:'x',parts:[{archive:'ignored',project:0,offset:0,length:1,sha256:'x'}]}]] as Array<[string,unknown]>,direct:string[]=[]
    const fetcher=async(input:RequestInfo|URL)=>{const url=String(input);if(url.endsWith('/control/manifest.json'))return new Response(JSON.stringify({contract:'shamela-search-v2/packed-manifest-1',coverageComplete:true,counts:{segments:1,expectedSegments:1,books:1,documents:1,positions:1},indexBucketCount:1,indexPattern:'index/{bucket}.json',source:{postingBucketCount:16,postingPattern:'postings/{bucket}.json',segmentSnippetPattern:'segments/{segment}/snippets/{bucket}.json',bucketCount:16}}));if(url.includes('/control/index/'))return new Response(JSON.stringify({entries}));if(url.includes('/archives/'))return new Response('x',{status:200});if(url.includes('/library/shamela-search-v2/')){direct.push(url);if(url.endsWith(paths[2]!))return new Response(JSON.stringify({entries:[[words[2],[[id,[2],77,segment]]]]}),{headers:{'content-type':'application/json'}});if(url.endsWith(snippetPath))return new Response(JSON.stringify({entries:[[id,'10',7,'ألا إن سلعة الله، ثم قيل: ألا إن سلعة الله','مؤلف',77]]}),{headers:{'content-type':'application/json'}})}return new Response(null,{status:404})}
    try{
      const client=new ShamelaSearchV2Client(fetcher as typeof fetch),page=await client.search('ألا إن سلعة الله',0,40),directPostings=direct.filter(url=>paths.some(path=>url.endsWith(path)))
      expect(page.total).toBe(2);expect(page.hits).toHaveLength(2)
      expect(page.hits[1]!.matchOffset).toBeGreaterThan(page.hits[0]!.matchOffset)
      const first=await client.search('ألا إن سلعة الله',0,1),second=await client.search('ألا إن سلعة الله',1,1)
      expect(first.total).toBe(2);expect(second.total).toBe(2)
      expect(first.hits).toEqual([page.hits[0]]);expect(second.hits).toEqual([page.hits[1]])
      expect(directPostings.some(url=>url.endsWith(paths[2]!))).toBe(true);expect(new Set(directPostings).size).toBeLessThanOrEqual(3);expect(direct.some(url=>url.endsWith(snippetPath))).toBe(true)
    }finally{if(previousLocation)Object.defineProperty(globalThis,'location',previousLocation);else Reflect.deleteProperty(globalThis,'location');if(previousConfig===undefined)delete (globalThis as typeof globalThis&{__SHAMELA_SEARCH_V2_PACKED__?:unknown}).__SHAMELA_SEARCH_V2_PACKED__;else (globalThis as typeof globalThis&{__SHAMELA_SEARCH_V2_PACKED__?:unknown}).__SHAMELA_SEARCH_V2_PACKED__=previousConfig}
  })
})

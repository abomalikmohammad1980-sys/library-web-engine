import { describe, expect, it, vi } from 'vitest'
import { ShamelaSearchClient, type WorkerPort } from './shamela_search_client'
import { ShamelaSearchV2Client } from './shamela_search_v2'

const worker:WorkerPort={postMessage:vi.fn(),addEventListener:vi.fn()}

describe('search resource recovery',()=>{
  it('retries a failed startup manifest on the same client',async()=>{
    let online=false
    const fetcher=vi.fn(async()=>{
      if(!online)throw new TypeError('Failed to fetch')
      return Response.json({contract:'shamela-search-v2/manifest-3',coverageComplete:true,counts:{books:8594}})
    })
    const client=new ShamelaSearchV2Client(fetcher as typeof fetch)
    await expect(client.search('',0,100)).rejects.toThrow()
    online=true
    await expect(client.search('',0,100)).resolves.toMatchObject({total:0,indexedBooks:8594})
  })
  it('falls back to the legacy index when a v2 resource fetch fails',async()=>{
    const client=new ShamelaSearchClient(worker,vi.fn() as unknown as typeof fetch,vi.fn(async()=>{throw new TypeError('Failed to fetch')}) as unknown as typeof fetch)
    const legacy=vi.spyOn(client,'search').mockResolvedValue({total:1,offset:0,limit:40,hits:[],unavailableBookIds:[],pendingBookIds:[],coverageComplete:true})
    await expect(client.searchCompleteV2('الجنة ورب النضر')).resolves.toMatchObject({total:1})
    // skipV2 prevents retrying the already failed V2 before legacy recovery.
    expect(legacy).toHaveBeenCalledWith('الجنة ورب النضر',0,40,undefined,undefined,true)
  })
})

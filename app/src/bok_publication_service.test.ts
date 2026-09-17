import {afterEach,it,expect,vi} from 'vitest'
import {bokEditorialCapabilities,bokPublicationRequest,bokPublicationStatus} from './bok_publication_service'
afterEach(()=>vi.unstubAllGlobals())
it('server disabled or unavailable keeps publication controls disabled',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({editingEnabled:false,submissionEnabled:true})))
 expect(await bokEditorialCapabilities(()=>true)).toEqual({editingEnabled:false,submissionEnabled:false})
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:403})))
 expect(await bokEditorialCapabilities(()=>true)).toEqual({editingEnabled:false,submissionEnabled:false})
})
it('late responses after identity change cannot authorize a submission',async()=>{
 let current=true;vi.stubGlobal('fetch',vi.fn(async()=>{current=false;return Response.json({job:{}})}))
 await expect(bokPublicationRequest(()=>current,'410000093')).rejects.toThrow(/جلسة/)
})
it('durable queued status is explicitly not publication',async()=>{
 const job={id:'id',bookId:'410000093',status:'awaiting_operator' as const,releaseId:null,failureCode:null,createdAt:'now'}
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({job,published:false},{status:202})))
 const received=await bokPublicationRequest(()=>true,job.bookId,{sourceHash:'a'.repeat(64),reviews:[]})
 expect(received?.status).toBe('awaiting_operator');expect(bokPublicationStatus(job)).toContain('لم يُنشر بعد')
})

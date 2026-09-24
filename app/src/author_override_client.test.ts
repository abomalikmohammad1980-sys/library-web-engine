import {describe,it,expect,vi} from 'vitest'
import {AuthorOverrideValidationError,loadAuthorOverride,saveAuthorOverride,loadAuthorOverrideHistory} from './author_override_client'
const row={authorId:'shamela:123',displayName:'البخاري',biography:'ترجمة',source:'مصدر',revision:1,updatedAt:'today'}
const historical={revision:2,displayName:'البخاري',biography:'ترجمة',source:'مصدر',reason:'سبب خاص',createdAt:'today'}
describe('read-only author history',()=>{
 it('requests bounded older pages using GET and projects only expected fields',async()=>{
  const fetcher=vi.fn(async()=>Response.json({authorId:row.authorId,history:[{...historical,actor_subject:'hidden'}],hasMore:true,nextBeforeVersion:2}))
  expect(await loadAuthorOverrideHistory(row.authorId,3,{fetch:fetcher})).toEqual({history:[historical],hasMore:true,nextBeforeVersion:2})
  const call=fetcher.mock.calls[0] as unknown as [string,RequestInit];expect(call[0]).toContain('limit=1&beforeVersion=3');expect(call[1].method).toBe('GET');expect(call[1].body).toBeUndefined()
 })
 it.each([
  {authorId:'wrong',history:[],hasMore:false,nextBeforeVersion:null},
  {authorId:row.authorId,history:[historical,historical],hasMore:false,nextBeforeVersion:null},
  {authorId:row.authorId,history:[historical],hasMore:true,nextBeforeVersion:3},
  {authorId:row.authorId,history:[{...historical,reason:7}],hasMore:false,nextBeforeVersion:null},
  {authorId:row.authorId,history:[{...historical,revision:3}],hasMore:false,nextBeforeVersion:null},
 ])('rejects malformed or non-progressing history',async payload=>{
  await expect(loadAuthorOverrideHistory(row.authorId,3,{fetch:async()=>Response.json(payload)})).rejects.toThrow('invalid_author_response')
 })
 it('rejects HTML, excess bytes and denied access without retry',async()=>{
  for(const response of [new Response('<html/>',{headers:{'content-type':'text/html'}}),new Response('x'.repeat(131073),{headers:{'content-type':'application/json'}})])await expect(loadAuthorOverrideHistory(row.authorId,undefined,{fetch:async()=>response})).rejects.toThrow()
  const fetcher=vi.fn(async()=>new Response(null,{status:403}));await expect(loadAuthorOverrideHistory(row.authorId,undefined,{fetch:fetcher})).rejects.toThrow('super_admin_required');expect(fetcher).toHaveBeenCalledTimes(1)
 })
 it('cancels a pending response body and does not return private data',async()=>{
  const controller=new AbortController();let cancelled=false
  const response=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'))},cancel(){cancelled=true}}),{headers:{'content-type':'application/json'}})
  const pending=loadAuthorOverrideHistory(row.authorId,undefined,{signal:controller.signal,fetch:async()=>response});setTimeout(()=>controller.abort(),5)
  await expect(pending).rejects.toThrow();expect(cancelled).toBe(true)
 })
})
describe('single author override client',()=>{
 it('preserves structured edits and empty narrative, rejects malformed structured data',async()=>{
  const edited={...row,biography:'',fields:{deathHijri:1399,places:['الهند']}}
  expect(await loadAuthorOverride(row.authorId,{fetch:async()=>Response.json({schemaVersion:1,override:edited})})).toEqual(edited)
  await expect(loadAuthorOverride(row.authorId,{fetch:async()=>Response.json({schemaVersion:1,override:{...edited,fields:{places:'wrong'}}})})).rejects.toThrow('invalid_author_response')
  const item={...historical,fields:{deathHijri:null,places:[]}}
  expect((await loadAuthorOverrideHistory(row.authorId,3,{fetch:async()=>Response.json({authorId:row.authorId,history:[item],hasMore:false,nextBeforeVersion:null})})).history[0]).toEqual(item)
 })
 it('preserves safe field diagnostics without exposing arbitrary server text',async()=>{
  const draft={expectedVersion:0,displayName:'يوسف عبد المجيد فايد',biography:'ترجمة',source:'',reason:''}
  const pending=saveAuthorOverride('shamela:1633',draft,{fetch:async()=>Response.json({error:'invalid_author_override',details:{field:'biography',reason:'too_long',actualLength:21000,maxLength:20000,privateText:'never show'}},{status:400})})
  const error=await pending.catch(error=>error)
  expect(error).toBeInstanceOf(AuthorOverrideValidationError)
  expect(error.issue).toEqual({field:'biography',reason:'too_long',actualLength:21000,maxLength:20000})
  expect(error.message).toBe('invalid_author_override')
 })
 it('accepts an optional empty source and history reason without rejecting a valid published biography',async()=>{
  const optional={...row,source:''};expect(await loadAuthorOverride(row.authorId,{fetch:async()=>Response.json({schemaVersion:1,override:optional})})).toEqual(optional)
  const item={...historical,source:'',reason:''};expect((await loadAuthorOverrideHistory(row.authorId,3,{fetch:async()=>Response.json({authorId:row.authorId,history:[item],hasMore:false,nextBeforeVersion:null})})).history).toEqual([item])
 })
 it('bounds public baseline body time and aborts its reader on timeout',async()=>{
  const timeout=new AbortController(),clock=vi.spyOn(AbortSignal,'timeout').mockReturnValue(timeout.signal);let cancelled=false
  const response=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'))},cancel(){cancelled=true}}))
  try{const pending=loadAuthorOverride(row.authorId,{fetch:async()=>response});setTimeout(()=>timeout.abort(),5);await expect(pending).rejects.toThrow();expect(clock).toHaveBeenCalledWith(8000);expect(cancelled).toBe(true)}finally{clock.mockRestore()}
 })
 it('requests one exact ID and exposes only public fields',async()=>{
  const fetcher=vi.fn(async()=>Response.json({schemaVersion:1,override:{...row,updated_by:'private'}}))
  expect(await loadAuthorOverride(row.authorId,{fetch:fetcher})).toEqual(row)
  expect(fetcher.mock.calls[0]?.[0]).toContain('?id=shamela%3A123')
 })
 it('missing is not confused with unavailable or wrong identity',async()=>{
  expect(await loadAuthorOverride(row.authorId,{fetch:async()=>new Response(null,{status:404})})).toBeNull()
  await expect(loadAuthorOverride(row.authorId,{fetch:async()=>new Response(null,{status:503})})).rejects.toThrow('author_overrides_unavailable')
  await expect(loadAuthorOverride(row.authorId,{fetch:async()=>Response.json({schemaVersion:1,override:{...row,authorId:'shamela:999'}})})).rejects.toThrow('invalid_author_response')
 })
 it('recovers the biography baseline after a transient failed request, without retrying invalid data',async()=>{
  const transport=vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('network interrupted')).mockResolvedValueOnce(Response.json({schemaVersion:1,override:row}))
  expect(await loadAuthorOverride(row.authorId,{fetch:transport})).toEqual(row)
  expect(transport).toHaveBeenCalledTimes(2)
  const service=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null,{status:503})).mockResolvedValueOnce(new Response(null,{status:404}))
  expect(await loadAuthorOverride(row.authorId,{fetch:service})).toBeNull()
  expect(service).toHaveBeenCalledTimes(2)
  const malformed=vi.fn<typeof fetch>().mockResolvedValue(Response.json({schemaVersion:1,override:{...row,authorId:'shamela:999'}}))
  await expect(loadAuthorOverride(row.authorId,{fetch:malformed})).rejects.toThrow('invalid_author_response')
  expect(malformed).toHaveBeenCalledTimes(1)
 })
 it('rejects invalid IDs, oversized responses and pre-aborted requests',async()=>{
  const fetcher=vi.fn(async()=>new Response('x'.repeat(131073)))
  await expect(loadAuthorOverride('../x',{fetch:fetcher})).rejects.toThrow('invalid_author_id');expect(fetcher).not.toHaveBeenCalled()
  await expect(loadAuthorOverride(row.authorId,{fetch:fetcher})).rejects.toThrow('invalid_author_response')
  await expect(loadAuthorOverride(row.authorId,{signal:AbortSignal.abort(),fetch:fetcher})).rejects.toThrow()
 })
 it('preserves version conflict without retrying or changing draft',async()=>{
  const draft={expectedVersion:1,displayName:'البخاري',biography:'نصي',source:'المصدر',reason:'تصحيح'}
  const fetcher=vi.fn(async()=>new Response(null,{status:409}))
  await expect(saveAuthorOverride(row.authorId,draft,{fetch:fetcher})).rejects.toThrow('author_override_conflict')
  expect(draft.expectedVersion).toBe(1);expect(fetcher).toHaveBeenCalledTimes(1)
 })
 it('sends CSRF header and exact expected revision, validates acknowledgement',async()=>{
  let init:RequestInit|undefined
  const draft={expectedVersion:1,displayName:'البخاري',biography:'نصي',source:'المصدر',reason:'تصحيح'}
  expect(await saveAuthorOverride(row.authorId,draft,{fetch:async(_url,options)=>{init=options;return Response.json({authorId:row.authorId,revision:2})}})).toBe(2)
  expect(new Headers(init?.headers).get('x-alkhizana-request')).toBe('account-ui');expect(JSON.parse(String(init?.body))).toEqual(draft)
 })
})

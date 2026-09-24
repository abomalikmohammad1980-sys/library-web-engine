import { describe, expect, it, vi } from 'vitest'
import { mirrorLocallySavedBookToAccount, retryPendingAccountBookMirrors } from './account_book_mirror'

const file = new File(['book'], 'كتاب.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
const input = { localBookId: 'local-1', file, title: 'كتاب المستخدم', author: 'المؤلف', category: 'الفقه' }
const claims = { subject: 'user-1', role: 'user' as const, sessionId: 'session-1' }
const memory = () => { let value: string | null = null; return { getItem: () => value, setItem: (_key: string, next: string) => { value = next } } }

describe('persistent account book mirror', () => {
  it('coalesces overlapping retries for the same account and queue', async () => {
    const storage = memory()
    await mirrorLocallySavedBookToAccount(input, { claims: () => claims, storage, submit: async () => { throw new Error('offline') } })
    let finish!: (value: { id: string; visibility: 'private'; reviewStatus: 'pending' }) => void
    const submit = vi.fn(() => new Promise<{ id: string; visibility: 'private'; reviewStatus: 'pending' }>(resolve => { finish = resolve }))
    const dependencies = { claims: () => claims, storage, submit, loadBook: async () => ({ id: 'local-1', title: input.title, author: input.author, fileName: file.name, fileSize: 4, addedAt: 1, data: new TextEncoder().encode('book'), mimeType: file.type }) }
    const first = retryPendingAccountBookMirrors(dependencies)
    const second = retryPendingAccountBookMirrors(dependencies)
    await Promise.resolve(); await Promise.resolve()
    expect(submit).toHaveBeenCalledTimes(1)
    finish({ id: 'remote', visibility: 'private', reviewStatus: 'pending' })
    expect(await first).toEqual({ uploaded: 1, remaining: 0 })
    expect(await second).toEqual({ uploaded: 1, remaining: 0 })
  })
  it('persists the source before the first request finishes, so a reload can recover it', async () => {
    const storage = memory()
    let finish!: (value: { id: string; visibility: 'private'; reviewStatus: 'pending' }) => void
    const attempt = mirrorLocallySavedBookToAccount(input, { claims: () => claims, storage, submit: () => new Promise(resolve => { finish = resolve }) })
    expect(JSON.parse(storage.getItem()!)).toMatchObject([{ subject: claims.subject, localBookId: input.localBookId }])
    finish({ id: 'remote', visibility: 'private', reviewStatus: 'pending' })
    await attempt
    expect(JSON.parse(storage.getItem()!)).toEqual([])
  })
  it('releases a failed flight and keeps different account queues independent', async () => {
    const storage = memory(), other = { ...claims, subject: 'user-2' }
    const fail = async () => { throw new Error('offline') }
    for (const account of [claims, other]) await mirrorLocallySavedBookToAccount(input, { claims: () => account, storage, submit: fail })
    const loadBook = async () => ({ id: 'local-1', title: input.title, author: input.author, fileName: file.name, fileSize: 4, addedAt: 1, data: new TextEncoder().encode('book'), mimeType: file.type })
    const base = { storage, loadBook }
    expect(await retryPendingAccountBookMirrors({ ...base, claims: () => claims, submit: fail })).toEqual({ uploaded: 0, remaining: 1 })
    const firstSubmit = vi.fn(async () => ({ id: 'first', visibility: 'private' as const, reviewStatus: 'pending' as const }))
    const otherSubmit = vi.fn(async () => ({ id: 'other', visibility: 'private' as const, reviewStatus: 'pending' as const }))
    const results = await Promise.all([
      retryPendingAccountBookMirrors({ ...base, claims: () => claims, submit: firstSubmit }),
      retryPendingAccountBookMirrors({ ...base, claims: () => other, submit: otherSubmit }),
    ])
    expect(results).toEqual([{ uploaded: 1, remaining: 0 }, { uploaded: 1, remaining: 0 }])
    expect(firstSubmit).toHaveBeenCalledTimes(1); expect(otherSubmit).toHaveBeenCalledTimes(1)
    expect(JSON.parse(storage.getItem()!)).toEqual([])
  })
  it('retains pending files after a temporary local database read failure', async () => {
    const storage = memory(), submit = vi.fn(async () => { throw new Error('offline') })
    await mirrorLocallySavedBookToAccount(input, { claims: () => claims, storage, submit })
    const result = await retryPendingAccountBookMirrors({ claims: () => claims, storage, submit, loadBook: async () => { throw new Error('database temporarily unavailable') } })
    expect(result).toEqual({ uploaded: 0, remaining: 1 })
    expect(submit).toHaveBeenCalledTimes(1)
  })
  it('never sends a queued source to an account selected while the local read is pending', async () => {
    const storage = memory(), failed = async () => { throw new Error('offline') }
    await mirrorLocallySavedBookToAccount(input, { claims: () => claims, storage, submit: failed })
    let active = claims
    const submit = vi.fn(async () => ({ id: 'wrong-owner', visibility: 'private' as const, reviewStatus: 'pending' as const }))
    const loadBook = async () => { active = { ...claims, subject: 'other-user' }; return { id: input.localBookId, title: input.title, author: input.author, fileName: file.name, fileSize: 4, addedAt: 1, data: new TextEncoder().encode('book'), mimeType: file.type } }
    expect(await retryPendingAccountBookMirrors({ claims: () => active, storage, submit, loadBook })).toEqual({ uploaded: 0, remaining: 0 })
    expect(JSON.parse(storage.getItem()!)).toHaveLength(1)
    expect(submit).not.toHaveBeenCalled()
  })
  it('uploads unchanged content only for an authenticated account', async () => {
    const submit = vi.fn(async () => ({ id: 'account-book-1', visibility: 'private' as const, reviewStatus: 'pending' as const }))
    await expect(mirrorLocallySavedBookToAccount(input, { claims: () => claims, submit, storage: memory() })).resolves.toEqual({ kind: 'uploaded', accountBookId: 'account-book-1' })
    expect(submit).toHaveBeenCalledWith({ file, title: input.title, author: input.author, category: input.category })
    await mirrorLocallySavedBookToAccount(input, { claims: () => null, submit, storage: memory() }); expect(submit).toHaveBeenCalledTimes(1)
  })
  it('uploads HTML companions in the original attempt and a queued retry',async()=>{
    const storage=memory(),submit=vi.fn(async()=>({id:'wrong',visibility:'private' as const,reviewStatus:'pending' as const}))
    const html=new File(['<p>متن</p>'],'book.html',{type:'text/html'})
    const loadBook=async()=>({id:'html-local',title:'كتاب HTML',author:'مؤلف',fileName:'book.html',fileSize:10,addedAt:1,data:new TextEncoder().encode('<p>متن</p>'),mimeType:'text/html',sourceFormat:'html' as const,htmlAssets:[{path:'image.png',data:new Uint8Array([1]),mimeType:'image/png'}]})
    const result=await mirrorLocallySavedBookToAccount({localBookId:'html-local',file:html,title:'كتاب HTML',author:'مؤلف'},{claims:()=>claims,storage,submit,loadBook})
    expect(result).toEqual({kind:'uploaded',accountBookId:'wrong'})
    expect(submit.mock.calls[0]![0].htmlResources).toMatchObject([{path:'image.png'}])
    expect(new Uint8Array(await submit.mock.calls[0]![0].htmlResources[0].file.arrayBuffer())).toEqual(new Uint8Array([1]))
    expect(await retryPendingAccountBookMirrors({claims:()=>claims,storage,submit,loadBook})).toEqual({uploaded:0,remaining:0})
    const failing=vi.fn(async()=>{throw Error('offline')})
    await mirrorLocallySavedBookToAccount({localBookId:'html-local',file:html,title:'كتاب HTML',author:'مؤلف'},{claims:()=>claims,storage,submit:failing,loadBook})
    expect(await retryPendingAccountBookMirrors({claims:()=>claims,storage,submit,loadBook})).toEqual({uploaded:1,remaining:0})
    expect(submit.mock.calls[1]![0].htmlResources).toMatchObject([{path:'image.png'}])
  })
  it('persists a failure, isolates it by account, then rebuilds the file from the local book', async () => {
    const storage = memory(), failing = vi.fn(async () => { throw new Error('offline') })
    await expect(mirrorLocallySavedBookToAccount(input, { claims: () => claims, submit: failing, storage })).resolves.toMatchObject({ kind: 'local-only' })
    const submit = vi.fn(async () => ({ id: 'remote-1', visibility: 'private' as const, reviewStatus: 'pending' as const }))
    const loadBook = vi.fn(async () => ({ id: 'local-1', title: input.title, author: input.author, fileName: file.name, fileSize: 4, addedAt: 1, data: new TextEncoder().encode('book'), mimeType: file.type }))
    await expect(retryPendingAccountBookMirrors({ claims: () => ({ ...claims, subject: 'other' }), submit, storage, loadBook })).resolves.toEqual({ uploaded: 0, remaining: 0 }); expect(loadBook).not.toHaveBeenCalled()
    await expect(retryPendingAccountBookMirrors({ claims: () => claims, submit, storage, loadBook })).resolves.toEqual({ uploaded: 1, remaining: 0 })
    expect(await submit.mock.calls[0]?.[0].file.text()).toBe('book')
  })
  it('retains the queue item while the endpoint remains unavailable', async () => {
    const storage = memory(), failing = vi.fn(async () => { throw new Error('offline') })
    await mirrorLocallySavedBookToAccount(input, { claims: () => claims, submit: failing, storage })
    const loadBook = async () => ({ id: 'local-1', title: input.title, author: input.author, fileName: file.name, fileSize: 1, addedAt: 1, data: new Uint8Array([1]), mimeType: file.type })
    await expect(retryPendingAccountBookMirrors({ claims: () => claims, submit: failing, storage, loadBook })).resolves.toEqual({ uploaded: 0, remaining: 1 })
  })
  it('keeps multipart retries distinct and restores the selected original volume', async () => {
    const storage = memory(), failing = vi.fn(async () => { throw new Error('offline') })
    for (const part of [1, 2]) await mirrorLocallySavedBookToAccount({ ...input, sourcePartNumber: part, file: new File([`part-${part}`], `part-${part}.docx`), title: `كتاب — الجزء ${part}` }, { claims: () => claims, submit: failing, storage })
    const submit = vi.fn(async () => ({ id: 'remote', visibility: 'private' as const, reviewStatus: 'pending' as const }))
    const loadBook = async () => ({ id: 'local-1', title: input.title, author: input.author, fileName: 'part-1.docx', fileSize: 10, addedAt: 1, data: new Uint8Array(), mimeType: file.type, volumes: [
      { number: 1, fileName: 'part-1.docx', data: new TextEncoder().encode('first'), mimeType: file.type },
      { number: 2, fileName: 'part-2.docx', data: new TextEncoder().encode('second'), mimeType: file.type },
    ] })
    await expect(retryPendingAccountBookMirrors({ claims: () => claims, submit, storage, loadBook })).resolves.toEqual({ uploaded: 2, remaining: 0 })
    expect(submit.mock.calls.map(call => call[0].file.name)).toEqual(['part-1.docx', 'part-2.docx'])
    expect(await submit.mock.calls[1]?.[0].file.text()).toBe('second')
  })
})

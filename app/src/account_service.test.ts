import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT_BOOK_MAX_BYTES, accountBookReviewFilePath, accountErrorArabic, accountReadinessArabic, cloudflareAccessAuthProvider, decideBookSubmission, deleteAccountBook, listAccountBooks, listAccountBooksPage, listBookSubmissions, listBookSubmissionsPage, loadAccountAdminAudit, loadAccountAdminMembers, loadAccountAdminStats, loadAccountMemberBooks, loadAccountReadiness, loadCentralBookVersions, mutateCentralBook, submitAccountBook, submitCentralBookCandidate } from './account_service'
import { currentAccountClaims, installTrustedRuntimeClaims, type AccountClaims } from './account_authority'
import { listAccountDevices } from './account_devices'

const privileged: AccountClaims = { subject: 'admin-1', role: 'super-admin', sessionId: 'session-1' }

describe('حد خصوصية جلسة الحساب', () => {
  beforeEach(() => installTrustedRuntimeClaims(privileged))
  it('يعيد الهوية الحالية المؤكدة للمسبارين المتزامنين دون إعادة تثبيت الرد القديم',async()=>{
    installTrustedRuntimeClaims(null)
    const finish:Array<(response:Response)=>void>=[]
    vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>finish.push(resolve))))
    const first=cloudflareAccessAuthProvider.currentSession(),second=cloudflareAccessAuthProvider.currentSession()
    finish[1](new Response(JSON.stringify({claims:privileged})))
    await expect(second).resolves.toEqual(privileged)
    finish[0](new Response(JSON.stringify({claims:privileged})))
    await expect(first).resolves.toEqual(privileged)
    expect(currentAccountClaims()).toEqual(privileged)
  })

  it('يرفض ترقية قديمة بعد تأكيد دور أحدث لنفس الجلسة',async()=>{
    let finish!:(response:Response)=>void
    vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve})))
    const pending=cloudflareAccessAuthProvider.currentSession()
    const newer:AccountClaims={...privileged,role:'user'}
    installTrustedRuntimeClaims(newer)
    finish(new Response(JSON.stringify({claims:privileged})))
    await expect(pending).rejects.toThrow('account_session_invalid')
    expect(currentAccountClaims()).toEqual(newer)
  })
  it('لا يعيد رد جلسة متأخر الصلاحيات بعد رفض الأجهزة',async()=>{
    let finish!:(response:Response)=>void
    vi.stubGlobal('fetch',vi.fn((path:string)=>path==='/api/account/native-session'?new Promise<Response>(resolve=>{finish=resolve}):Promise.resolve(new Response(JSON.stringify({error:'authentication_required'}),{status:401}))))
    const pending=cloudflareAccessAuthProvider.currentSession()
    await expect(listAccountDevices()).rejects.toThrow('authentication_required')
    finish(new Response(JSON.stringify({claims:privileged})))
    await expect(pending).rejects.toThrow('account_session_invalid')
    expect(currentAccountClaims()).toBeNull()
  })

  it('لا يمحو فشل جلسة قديمة هوية أحدث',async()=>{
    let finish!:(response:Response)=>void
    vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve})))
    const pending=cloudflareAccessAuthProvider.currentSession()
    const newer={...privileged,sessionId:'new-session'}
    installTrustedRuntimeClaims(newer)
    finish(new Response(null,{status:503}))
    await expect(pending).rejects.toThrow()
    expect(currentAccountClaims()).toEqual(newer)
  })
  it.each(['device_limit_reached','device_revoked'])('يحفظ سبب رفض الجهاز دون إعادة طلب الجلسة: %s',async code=>{
    const fetchSpy=vi.fn(async()=>new Response(JSON.stringify({error:code}),{status:403}))
    vi.stubGlobal('fetch',fetchSpy)
    await expect(cloudflareAccessAuthProvider.currentSession()).rejects.toThrow(code)
    expect(currentAccountClaims()).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(accountErrorArabic(new Error(code))).not.toContain(code)
  })

  it.each([{visibility:'public',reviewStatus:'approved'},{visibility:'private',reviewStatus:'rejected'}])('يقبل إعادة محاولة كتاب سبق حفظه ومراجعته %#',async state=>{
    const saved={id:'source-existing',...state}
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(saved),{status:200})))
    await expect(submitAccountBook({file:new File(['كتاب'],'book.txt'),title:'كتاب',author:'مؤلف'})).resolves.toEqual(saved)
  })

  it('يطابق حد الرفع في الواجهة حد Pages البالغ 64 MiB',()=>{expect(ACCOUNT_BOOK_MAX_BYTES).toBe(64*1024*1024)})

  it.each([
    { subject: '', role: 'super-admin', sessionId: 'session-2' },
    { subject: 'attacker', role: 'owner', sessionId: 'session-2' },
    { subject: 'attacker', role: 'super-admin', sessionId: '' },
    null,
  ])('يرفض claims المشوهة ويمحو الصلاحية القديمة %#', async claims => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ claims }), { status: 200, headers: { 'content-type': 'application/json' } })))
    await expect(cloudflareAccessAuthProvider.currentSession()).rejects.toThrow('account_session_invalid')
    expect(currentAccountClaims()).toBeNull()
  })

  it('يمحو الصلاحية القديمة عند تعذر خدمة الجلسة', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })))
    await expect(cloudflareAccessAuthProvider.currentSession()).rejects.toThrow('account_service_unavailable')
    expect(currentAccountClaims()).toBeNull()
  })

  it('يقرأ سبب عدم جاهزية الحسابات من عقد محدود ولا يعرض رسالة الخادم الخام',async()=>{
    const payload={ready:false,access:{configured:false,missing:['ACCOUNT_ACCESS_DOMAIN','ACCOUNT_ACCESS_AUD']},bindings:{visitorsDb:true,libraryR2:false},message:'تفصيل خادم لا يُعرض'}
    const fetchSpy=vi.fn(async()=>new Response(JSON.stringify(payload),{status:503,headers:{'content-type':'application/json'}}))
    vi.stubGlobal('fetch',fetchSpy)
    await expect(loadAccountReadiness()).resolves.toEqual({ready:false,access:payload.access,bindings:payload.bindings,message:payload.message})
    expect(accountReadinessArabic(payload)).toBe('منظومة الحسابات غير جاهزة الآن.')
    expect(accountReadinessArabic(payload)).not.toContain(payload.message)
    expect(fetchSpy).toHaveBeenCalledWith('/api/account/readiness',expect.objectContaining({credentials:'same-origin',cache:'no-store'}))
  })

  it('يرفض تناقض HTTP مع علم الجاهزية أو عقدًا مشوهًا',async()=>{
    const fetchSpy=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ready:true,access:{configured:true,missing:[]},bindings:{visitorsDb:true,libraryR2:true}}),{status:503}))
      .mockResolvedValueOnce(new Response(JSON.stringify({ready:false,access:{configured:false,missing:'secret'},bindings:{visitorsDb:false,libraryR2:false}}),{status:503}))
    vi.stubGlobal('fetch',fetchSpy)
    await expect(loadAccountReadiness()).rejects.toThrow('account_response_invalid')
    await expect(loadAccountReadiness()).rejects.toThrow('account_response_invalid')
  })

  it('يثبت claims كاملة فقط ويطلب الجلسة دون cache أو credentials عابرة للمواقع', async () => {
    const claims: AccountClaims = { subject: 'user-1', role: 'user', sessionId: 'session-2', displayName: 'قارئ' }
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ claims }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchSpy)
    await expect(cloudflareAccessAuthProvider.currentSession()).resolves.toEqual(claims)
    expect(currentAccountClaims()).toEqual(claims)
    expect(fetchSpy).toHaveBeenCalledWith('/api/account/native-session', expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }))
  })

  it.each([401, 403])('يمحو claims قديمة إذا رفض API الخاص التفويض بحالة %s', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'تفاصيل داخلية لا تعرض' }), { status, headers: { 'content-type': 'application/json' } })))
    await expect(listAccountBooks()).rejects.toThrow(status === 401 ? 'account_session_required' : 'account_permission_denied')
    expect(currentAccountClaims()).toBeNull()
  })

  it('لا يعرض رسالة الخادم الخام ويمنع cache عند قراءة كتب الحساب', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ error: 'D1 users/private/r2-key failed' }), { status: 500, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchSpy)
    await expect(listAccountBooks()).rejects.toThrow('account_service_unavailable')
    await expect(listAccountBooks()).rejects.not.toThrow('D1 users/private/r2-key failed')
    expect(fetchSpy).toHaveBeenCalledWith('/api/account/books?page=0&limit=50', expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }))
  })

  it('يمحو صلاحية الإدارة إذا رفض الخادم قرار المراجعة', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 403 })))
    await expect(decideBookSubmission('book/private', 'publish')).rejects.toThrow('account_permission_denied')
    expect(currentAccountClaims()).toBeNull()
  })

  it.each([
    [{ name: 'payload.exe', size: 10, type: 'application/pdf' }, 'account_book_type_rejected'],
    [{ name: 'empty.docx', size: 0, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, 'account_book_empty'],
    [{ name: 'huge.pdf', size: ACCOUNT_BOOK_MAX_BYTES + 1, type: 'application/pdf' }, 'account_book_too_large'],
  ] as const)('يرفض ملف الحساب غير الآمن محليًا قبل أي شبكة %#', async (file, code) => {
    const fetchSpy=vi.fn();vi.stubGlobal('fetch',fetchSpy)
    await expect(submitAccountBook({file:file as File,title:'كتاب',author:'مؤلف'})).rejects.toThrow(code)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it.each([
    [{title:'   ',author:'مؤلف'},'account_book_title_invalid'],
    [{title:'كتاب',author:'   '},'account_book_author_invalid'],
    [{title:'كتاب',author:'مؤلف',category:'ص'.repeat(121)},'account_book_category_invalid'],
  ])('يرفض metadata غير الصالحة قبل رفع البايتات %#', async (metadata,code) => {
    const fetchSpy=vi.fn();vi.stubGlobal('fetch',fetchSpy)
    const file={name:'book.docx',size:10,type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'} as File
    await expect(submitAccountBook({file,...metadata})).rejects.toThrow(code)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('يسقط ownerEmail من مسار كتب المستخدم ويبقيه لمسار الإدارة فقط',async()=>{
    const row={id:'b',title:'كتاب',author:'مؤلف',mimeType:'application/pdf',byteLength:10,visibility:'private',reviewStatus:'pending',createdAt:'2026-08-31T00:00:00Z',ownerEmail:'private@example.test'}
    const fetchSpy=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({books:[row],page:0,hasMore:false}),{status:200,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({submissions:[row],page:0,hasMore:false}),{status:200,headers:{'content-type':'application/json'}}))
    vi.stubGlobal('fetch',fetchSpy)
    await expect(listAccountBooks()).resolves.toEqual([{id:'b',title:'كتاب',author:'مؤلف',mimeType:'application/pdf',byteLength:10,visibility:'private',reviewStatus:'pending',createdAt:'2026-08-31T00:00:00Z'}])
    await expect(listBookSubmissions()).resolves.toEqual([row])
    expect(fetchSpy).toHaveBeenLastCalledWith('/api/admin/book-submissions?status=pending&page=0&limit=50',expect.anything())
  })

  it.each([
    {books:[{id:'b',title:'كتاب'}]},
    {books:[{id:'b',title:'كتاب',author:'مؤلف',mimeType:'x',byteLength:-1,visibility:'private',reviewStatus:'pending',createdAt:'bad'}]},
    {books:'not-an-array'},
  ])('يرفض استجابة كتب حساب مشوهة كاملة بدل عرض بيانات جزئية %#',async payload=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}})))
    await expect(listAccountBooks()).rejects.toThrow('account_response_invalid')
  })

  it.each(['',' id-with-spaces ','x'.repeat(201)])('يرفض هوية كتاب رفع غير قابلة للملكية والحذف %#',async id=>{
    const file=new File(['كتاب'],'book.txt',{type:'text/plain'})
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({id,visibility:'private',reviewStatus:'pending'}),{status:201})))
    await expect(submitAccountBook({file,title:'كتاب',author:'مؤلف'})).rejects.toThrow('account_response_invalid')
  })

  it('يرفع المدير الإضافة المركزية كمرشح خاص قيد المراجعة فقط',async()=>{
    const file=new File(['كتاب مركزي'],'central.bok',{type:'application/octet-stream'}),fetchSpy=vi.fn(async()=>new Response(JSON.stringify({id:'candidate-1',visibility:'private',reviewStatus:'pending'}),{status:201}))
    vi.stubGlobal('fetch',fetchSpy)
    await expect(submitCentralBookCandidate({file,title:'عنوان موثق',author:'مؤلف موثق',category:'فقه'})).resolves.toEqual({id:'candidate-1',visibility:'private',reviewStatus:'pending'})
    const body=(fetchSpy.mock.calls[0]?.[1] as RequestInit).body as FormData
    expect(body.get('title')).toBe('عنوان موثق')
    expect(body.get('author')).toBe('مؤلف موثق')
  })

  it('يمنع غير المدير من إنشاء مرشح مركزي قبل الشبكة',async()=>{
    installTrustedRuntimeClaims({subject:'reader-1',role:'user',sessionId:'reader-session'})
    const fetchSpy=vi.fn();vi.stubGlobal('fetch',fetchSpy)
    await expect(submitCentralBookCandidate({file:new File(['x'],'book.txt',{type:'text/plain'}),title:'كتاب',author:'مؤلف'})).rejects.toThrow(/ليس لديك إذن/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('ينشئ مسار ملف المراجعة من هوية مضبوطة وللمدير فقط',()=>{
    expect(accountBookReviewFilePath('book/جزء 1')).toBe('/api/account/books/book%2F%D8%AC%D8%B2%D8%A1%201/file')
    expect(()=>accountBookReviewFilePath(' book ')).toThrow('account_book_id_invalid')
    installTrustedRuntimeClaims({subject:'reader-1',role:'user',sessionId:'reader-session'})
    expect(()=>accountBookReviewFilePath('book-1')).toThrow(/ليس لديك إذن/)
  })

  it('يرفض صف كتاب حساب بهوية أو metadata غير مستقرة',async()=>{
    const row={id:' b ',title:' ',author:'مؤلف',mimeType:'application/pdf',byteLength:10,visibility:'private',reviewStatus:'pending',createdAt:'2026-09-01T00:00:00Z'}
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({books:[row],page:0,hasMore:false}),{status:200})))
    await expect(listAccountBooksPage()).rejects.toThrow('account_response_invalid')
  })

  it('لا يبدأ الضيف أي طلب لكتب الحساب أو الإدارة',async()=>{
    installTrustedRuntimeClaims(null)
    const fetchSpy=vi.fn();vi.stubGlobal('fetch',fetchSpy)
    const file={name:'book.docx',size:10,type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'} as File
    await expect(listAccountBooks()).rejects.toThrow('account_session_required')
    await expect(submitAccountBook({file,title:'كتاب',author:'مؤلف'})).rejects.toThrow('account_session_required')
    await expect(listBookSubmissions()).rejects.toThrow(/ليس لديك إذن/)
    await expect(decideBookSubmission('b','publish')).rejects.toThrow(/ليس لديك إذن/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('يقبل إحصاءات الإدارة الصحيحة ويرفض العدادات المشوهة',async()=>{
    const valid={accountsTotal:12,booksTotal:20,pending:4,approved:13,rejected:3,publicBooks:8,privateBooks:12}
    const fetchSpy=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({stats:valid}),{status:200,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({stats:{...valid,rejected:-1}}),{status:200,headers:{'content-type':'application/json'}}))
    vi.stubGlobal('fetch',fetchSpy)
    await expect(loadAccountAdminStats()).resolves.toEqual(valid)
    await expect(loadAccountAdminStats()).rejects.toThrow('account_response_invalid')
  })

  it('يرفض عدادات لوحة الإدارة الصحيحة نوعيًا إذا تناقضت المجاميع',async()=>{
    const base={accountsTotal:12,booksTotal:20,pending:4,approved:13,rejected:3,publicBooks:8,privateBooks:12}
    const fetchSpy=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({stats:{...base,pending:5}}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({stats:{...base,privateBooks:11}}),{status:200}))
    vi.stubGlobal('fetch',fetchSpy)
    await expect(loadAccountAdminStats()).rejects.toThrow('account_response_invalid')
    await expect(loadAccountAdminStats()).rejects.toThrow('account_response_invalid')
  })

  it('يقرأ تقسيم كتب الحسابات ويرفض هوية أو مجموعًا مشوهًا',async()=>{
    const valid={accountId:'account-1',displayName:'مدير المكتبة',email:'admin@example.test',booksTotal:7,pending:2,approved:4,rejected:1}
    const fetchSpy=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({accounts:[valid],page:0,hasMore:false}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({accounts:[{...valid,pending:3}],page:0,hasMore:false}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({accounts:[{...valid,email:' '}],page:0,hasMore:false}),{status:200}))
    vi.stubGlobal('fetch',fetchSpy)
    await expect(loadAccountAdminMembers()).resolves.toEqual([valid])
    await expect(loadAccountAdminMembers()).rejects.toThrow('account_response_invalid')
    await expect(loadAccountAdminMembers()).rejects.toThrow('account_response_invalid')
  })

  it('يجمع صفحات الحسابات ويرفض تكرار الحساب بين صفحتين',async()=>{
    const account={accountId:'account-1',displayName:'قارئ',email:'reader@example.test',booksTotal:0,pending:0,approved:0,rejected:0}
    const fetchSpy=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({accounts:[account],page:0,hasMore:true}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({accounts:[{...account,accountId:'account-2'}],page:1,hasMore:false}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({accounts:[account],page:0,hasMore:true}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({accounts:[account],page:1,hasMore:false}),{status:200}))
    vi.stubGlobal('fetch',fetchSpy)
    await expect(loadAccountAdminMembers()).resolves.toHaveLength(2)
    await expect(loadAccountAdminMembers()).rejects.toThrow('account_response_invalid')
  })

  it('يعرض كتب الحساب من ترشيح المالك الخادمي ويرفض الهوية غير المنضبطة قبل الشبكة',async()=>{
    const base={id:'b1',title:'كتاب خاص',author:'مؤلف',mimeType:'application/pdf',byteLength:10,visibility:'private',reviewStatus:'pending',createdAt:'2026-09-01T00:00:00Z',ownerEmail:'first@example.test'}
    const fetchSpy=vi.fn(async()=>new Response(JSON.stringify({submissions:[base],page:0,hasMore:false}),{status:200}))
    vi.stubGlobal('fetch',fetchSpy)
    await expect(loadAccountMemberBooks('account-1')).resolves.toEqual([base])
    expect(fetchSpy).toHaveBeenCalledWith('/api/admin/book-submissions?status=all&page=0&limit=50&owner=account-1',expect.anything())
    await expect(loadAccountMemberBooks(' account-1 ')).rejects.toThrow('account_owner_invalid')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('يرفض قرار مراجعة غير مضبوط قبل الشبكة',async()=>{
    const fetchSpy=vi.fn();vi.stubGlobal('fetch',fetchSpy)
    await expect(decideBookSubmission('   ','publish')).rejects.toThrow('account_book_id_invalid')
    await expect(decideBookSubmission('b','unsafe' as 'publish')).rejects.toThrow('account_review_decision_invalid')
    await expect(decideBookSubmission('b','reject','x'.repeat(1001))).rejects.toThrow('account_review_note_invalid')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('يرفض مرشح مراجعة غير معروف قبل الشبكة',async()=>{const fetchSpy=vi.fn();vi.stubGlobal('fetch',fetchSpy);await expect(listBookSubmissions('unsafe' as 'pending')).rejects.toThrow('account_review_status_invalid');expect(fetchSpy).not.toHaveBeenCalled()})
  it('يقرأ صفحة مراجعة محدودة ويرفض حدًا غير آمن',async()=>{const fetchSpy=vi.fn(async()=>new Response(JSON.stringify({submissions:[],page:2,hasMore:false}),{status:200}));vi.stubGlobal('fetch',fetchSpy);await expect(listBookSubmissionsPage('all',2,20)).resolves.toEqual({submissions:[],page:2,hasMore:false});await expect(listBookSubmissionsPage('all',0,101)).rejects.toThrow('account_review_page_invalid');expect(fetchSpy).toHaveBeenCalledTimes(1)})
  it('يرفض خلط حالة أو تكرار كتاب داخل صفحة طابور الإدارة',async()=>{
    const row={id:'b',title:'كتاب',author:'مؤلف',mimeType:'application/pdf',byteLength:10,visibility:'private',reviewStatus:'approved',createdAt:'2026-09-01T00:00:00Z'}
    const fetchSpy=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({submissions:[row],page:0,hasMore:false}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({submissions:[{...row,reviewStatus:'pending'},{...row,reviewStatus:'pending'}],page:0,hasMore:false}),{status:200}))
    vi.stubGlobal('fetch',fetchSpy)
    await expect(listBookSubmissionsPage('pending')).rejects.toThrow('account_response_invalid')
    await expect(listBookSubmissionsPage('pending')).rejects.toThrow('account_response_invalid')
  })
  it('يقرأ صفحة كتب الحساب ويرفض حدًا غير آمن',async()=>{const fetchSpy=vi.fn(async()=>new Response(JSON.stringify({books:[],page:3,hasMore:false}),{status:200}));vi.stubGlobal('fetch',fetchSpy);await expect(listAccountBooksPage(3,25)).resolves.toEqual({books:[],page:3,hasMore:false});await expect(listAccountBooksPage(0,101)).rejects.toThrow('account_books_page_invalid');expect(fetchSpy).toHaveBeenCalledTimes(1)})

  it('يفشل مغلقًا عند صفحة فارغة تدعي وجود المزيد أو تتجاوز الحد',async()=>{
    const row={id:'b',title:'كتاب',author:'مؤلف',mimeType:'application/pdf',byteLength:10,visibility:'private',reviewStatus:'pending',createdAt:'2026-09-01T00:00:00Z'}
    const fetchSpy=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({books:[],page:0,hasMore:true}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({submissions:[row,{...row,id:'c'}],page:0,hasMore:false}),{status:200}))
    vi.stubGlobal('fetch',fetchSpy)
    await expect(listAccountBooksPage(0,20)).rejects.toThrow('account_response_invalid')
    await expect(listBookSubmissionsPage('pending',0,1)).rejects.toThrow('account_response_invalid')
  })

  it('يجمع كل صفحات كتب الحساب ويرفض تكرار الهوية بين صفحتين',async()=>{
    const row={id:'a',title:'كتاب',author:'مؤلف',mimeType:'application/pdf',byteLength:10,visibility:'private',reviewStatus:'pending',createdAt:'2026-09-01T00:00:00Z'}
    const fetchSpy=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({books:[row],page:0,hasMore:true}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({books:[{...row,id:'b'}],page:1,hasMore:false}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({books:[row],page:0,hasMore:true}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({books:[row],page:1,hasMore:false}),{status:200}))
    vi.stubGlobal('fetch',fetchSpy)
    await expect(listAccountBooks()).resolves.toEqual([row,{...row,id:'b'}])
    await expect(listAccountBooks()).rejects.toThrow('account_response_invalid')
  })

  it('يجمع كل صفحات المراجعات بدل إسقاط ما بعد الصفحة الأولى',async()=>{
    const row={id:'a',title:'كتاب',author:'مؤلف',mimeType:'application/pdf',byteLength:10,visibility:'private',reviewStatus:'pending',createdAt:'2026-09-01T00:00:00Z'}
    const fetchSpy=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({submissions:[row],page:0,hasMore:true}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({submissions:[{...row,id:'b'}],page:1,hasMore:false}),{status:200}))
    vi.stubGlobal('fetch',fetchSpy)
    await expect(listBookSubmissions('pending')).resolves.toEqual([row,{...row,id:'b'}])
  })

  it('يضع علامة طلب لا يمكن للمتصل إسقاطها على mutation الحساب',async()=>{
    const fetchSpy=vi.fn(async()=>new Response(JSON.stringify({id:'b',visibility:'public',reviewStatus:'approved'}),{status:200,headers:{'content-type':'application/json'}}));vi.stubGlobal('fetch',fetchSpy)
    await decideBookSubmission(' b ','publish','  راجع  ')
    expect(fetchSpy).toHaveBeenCalledWith('/api/admin/book-submissions/b',expect.objectContaining({headers:expect.objectContaining({'x-alkhizana-request':'account-ui'}),body:JSON.stringify({decision:'publish',note:'راجع',reviewVersion:0})}))
  })

  it('يرسل نسخة المراجعة ويميز تعارض المدير عن فشل الخدمة',async()=>{
    const fetchSpy=vi.fn(async()=>new Response(JSON.stringify({error:'review_conflict'}),{status:409,headers:{'content-type':'application/json'}}));vi.stubGlobal('fetch',fetchSpy)
    await expect(decideBookSubmission('b','reject','ملاحظة محفوظة',7)).rejects.toThrow('account_review_conflict')
    expect(fetchSpy).toHaveBeenCalledWith('/api/admin/book-submissions/b',expect.objectContaining({body:JSON.stringify({decision:'reject',note:'ملاحظة محفوظة',reviewVersion:7})}))
  })
  it('يميز امتلاء مساحة الحساب عن تعارض المراجعة',async()=>{const fetchSpy=vi.fn(async()=>new Response(JSON.stringify({error:'account_storage_quota_exceeded'}),{status:409,headers:{'content-type':'application/json'}}));vi.stubGlobal('fetch',fetchSpy);const file=new File(['كتاب'],'book.txt',{type:'text/plain'});await expect(submitAccountBook({file,title:'كتاب',author:'مؤلف'})).rejects.toThrow('account_storage_quota_exceeded');expect(accountErrorArabic(new Error('account_storage_quota_exceeded'))).toContain('الحد المسموح')})

  it('يرسل نسخة الكتاب المركزي ويميز تعارضها عن تعارض المراجعة',async()=>{const fetchSpy=vi.fn(async()=>new Response(JSON.stringify({error:'central_book_conflict',revision:8}),{status:409,headers:{'content-type':'application/json'}}));vi.stubGlobal('fetch',fetchSpy);await expect(mutateCentralBook('4101',{action:'update',expectedVersion:7,title:'مسودة'})).rejects.toThrow('account_central_conflict');expect(fetchSpy).toHaveBeenCalledWith('/api/admin/library-books/4101',expect.objectContaining({body:JSON.stringify({action:'update',expectedVersion:7,title:'مسودة'})}));expect(accountErrorArabic(new Error('account_central_conflict'))).toContain('بقيت تعديلاتك')})
  it.each([
    {id:'other',action:'update',visibility:'public',logicallyDeleted:false,revision:4},
    {id:'4101',action:'restore',visibility:'public',logicallyDeleted:false,revision:4},
    {id:'4101',action:'update',visibility:'public',logicallyDeleted:false,revision:3},
    {id:'4101',action:'update',visibility:'hidden',logicallyDeleted:true,revision:4},
  ])('يرفض نجاح تعديل مركزي لا يطابق الكتاب والإجراء والإصدار %#',async result=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(result),{status:200})));await expect(mutateCentralBook('4101',{action:'update',expectedVersion:3,title:'مسودة'})).rejects.toThrow('account_response_invalid')})
  it('يقبل حذفًا مركزيًا مطابقًا يرفع الإصدار ويخفي الكتاب',async()=>{const result={id:'4101',action:'delete',visibility:'hidden',logicallyDeleted:true,revision:5};vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(result),{status:200})));await expect(mutateCentralBook('4101',{action:'delete',expectedVersion:4})).resolves.toEqual(result)})
  it('يقرأ نسخ التعديلات المركزية ويرفض نسخة مشوهة',async()=>{const fetchSpy=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({overrides:[{bookId:'4101',revision:3}]}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({overrides:[{bookId:'4101',revision:-1}]}),{status:200}));vi.stubGlobal('fetch',fetchSpy);await expect(loadCentralBookVersions()).resolves.toEqual(new Map([['4101',3]]));await expect(loadCentralBookVersions()).rejects.toThrow('account_response_invalid')})
  it('يحذف اعتمادًا على النسخة الإدارية الحديثة وليس الكاش العام',async()=>{
    const spy=vi.fn(async(url:string,init?:RequestInit)=>{
      if(url==='/api/library/central-overrides')return new Response(JSON.stringify({overrides:[{bookId:'4101',revision:2}]}))
      if(url==='/api/admin/library-books')return new Response(JSON.stringify({overrides:[{bookId:'4101',revision:7}]}))
      const body=JSON.parse(String(init?.body));expect(body.expectedVersion).toBe(7)
      return new Response(JSON.stringify({id:'4101',action:'delete',visibility:'hidden',logicallyDeleted:true,revision:8}))
    });vi.stubGlobal('fetch',spy)
    const versions=await loadCentralBookVersions()
    await expect(mutateCentralBook('4101',{action:'delete',expectedVersion:versions.get('4101')!})).resolves.toMatchObject({revision:8,logicallyDeleted:true})
    expect(spy).toHaveBeenCalledWith('/api/admin/library-books',expect.objectContaining({cache:'no-store'}))
    expect(spy.mock.calls.some(([url])=>url==='/api/library/central-overrides')).toBe(false)
  })
  it('يرفض نسخة تعديل مركزي غير صالحة قبل الشبكة',async()=>{const fetchSpy=vi.fn();vi.stubGlobal('fetch',fetchSpy);await expect(mutateCentralBook('4101',{action:'update',expectedVersion:-1})).rejects.toThrow('account_central_version_invalid');expect(fetchSpy).not.toHaveBeenCalled()})
  it('يحذف كتاب الحساب بعلامة CSRF ويتحقق من الرد',async()=>{const fetchSpy=vi.fn(async()=>new Response(JSON.stringify({id:'b1',deleted:true}),{status:200}));vi.stubGlobal('fetch',fetchSpy);await expect(deleteAccountBook(' b1 ')).resolves.toEqual({id:'b1',deleted:true});expect(fetchSpy).toHaveBeenCalledWith('/api/account/books/b1',expect.objectContaining({method:'DELETE',headers:expect.objectContaining({'x-alkhizana-request':'account-ui'})}))})
  it('يميز منع حذف المنشور وفشل التنظيف القابل للاستئناف',async()=>{const fetchSpy=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:'published_book_must_be_withdrawn'}),{status:409})).mockResolvedValueOnce(new Response(JSON.stringify({error:'account_book_deletion_pending'}),{status:503}));vi.stubGlobal('fetch',fetchSpy);await expect(deleteAccountBook('b1')).rejects.toThrow('published_book_must_be_withdrawn');await expect(deleteAccountBook('b1')).rejects.toThrow('account_book_deletion_pending')})

  it('يرفض نسخة مراجعة غير صالحة قبل الشبكة',async()=>{const fetchSpy=vi.fn();vi.stubGlobal('fetch',fetchSpy);await expect(decideBookSubmission('b','publish','',-1)).rejects.toThrow('account_review_version_invalid');expect(fetchSpy).not.toHaveBeenCalled()})

  it.each([
    ['publish',{id:'b',visibility:'private',reviewStatus:'approved'}],
    ['private',{id:'b',visibility:'public',reviewStatus:'approved'}],
    ['reject',{id:'b',visibility:'private',reviewStatus:'pending'}],
  ] as const)('يرفض نتيجة خادم لا تطابق انتقال قرار %s',async(decision,result)=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(result),{status:200,headers:{'content-type':'application/json'}})))
    await expect(decideBookSubmission('b',decision)).rejects.toThrow('account_response_invalid')
  })

  it('يرفض نتيجة قبول تخص كتابًا آخر',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({id:'other',visibility:'public',reviewStatus:'approved'}),{status:200})))
    await expect(decideBookSubmission('expected','publish')).rejects.toThrow('account_response_invalid')
  })

  it('يحوّل رموز الحساب إلى رسائل عربية آمنة ولا يعرض الرموز أو تفاصيل مجهولة',()=>{
    expect(accountErrorArabic(new Error('account_book_type_rejected'))).toBe('صيغة هذا الملف غير مدعومة.')
    expect(accountErrorArabic(new Error('account_review_conflict'))).toContain('غيّر مدير آخر')
    expect(accountErrorArabic(new Error('D1 private key leaked'),'تعذّر الحفظ.')).toBe('تعذّر الحفظ.')
    expect(accountErrorArabic(null,'تعذّر الحفظ.')).toBe('تعذّر الحفظ.')
  })
  it('يقرأ سجل التدقيق المركزي المقيّد ويرفض صفوفًا مشوهة',async()=>{const event={id:'1',kind:'review',bookId:'b',actorName:'مدير',action:'publish',createdAt:'2026-09-01T00:00:00Z'},fetchSpy=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({events:[event],page:0,hasMore:false}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({events:[{...event,actorName:''}],page:0,hasMore:false}),{status:200}));vi.stubGlobal('fetch',fetchSpy);await expect(loadAccountAdminAudit()).resolves.toEqual({events:[event],page:0,hasMore:false});await expect(loadAccountAdminAudit()).rejects.toThrow('account_response_invalid');expect(fetchSpy).toHaveBeenCalledWith('/api/admin/audit-events?page=0&limit=50',expect.anything())})
  it('يرفض تكرار حدث واحد في صفحة سجل التدقيق',async()=>{const event={id:'1',kind:'review',bookId:'b',actorName:'مدير',action:'publish',createdAt:'2026-09-01T00:00:00Z'};vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({events:[event,event],page:0,hasMore:false}),{status:200})));await expect(loadAccountAdminAudit()).rejects.toThrow('account_response_invalid')})
})

import { currentAccountClaims, type AccountClaims } from './account_authority'
import { submitAccountBook } from './account_service'
import { getBook, type StoredBook } from './engine/library_store'
import {createWordBundleUpload} from './word_bundle_transfer'
import {centralBookUploadInput} from './central_book_upload'

const QUEUE_KEY = 'alkhizana:account-book-mirror:v1'
const MAX_QUEUE_ITEMS = 500
export type AccountBookMirrorResult = { kind: 'not-authenticated' } | { kind: 'session-changed' } | { kind: 'uploaded'; accountBookId: string } | { kind: 'local-only'; error: unknown }
interface AccountBookMirrorInput { localBookId: string; sourcePartNumber?: number; file: File; title: string; author: string; category?: string; wordCompanion?:boolean;imageBook?:boolean }
interface PendingMirror { subject: string; localBookId: string; sourcePartNumber?: number; title: string; author: string; category?: string; wordCompanion?:boolean; imageBook?:boolean }
interface MirrorDependencies { claims?: () => AccountClaims | null; submit?: typeof submitAccountBook; storage?: Pick<Storage, 'getItem' | 'setItem'>; loadBook?: (id: string) => Promise<StoredBook | undefined>; prepareBundle?:typeof createWordBundleUpload }
type RetryResult = { uploaded: number; remaining: number }
const absentStorage = {}
const retryFlights = new WeakMap<object, Map<string, Promise<RetryResult>>>()

/** A remote failure never rolls back the authoritative local import. */
export async function mirrorLocallySavedBookToAccount(input: AccountBookMirrorInput, dependencies: MirrorDependencies = {}): Promise<AccountBookMirrorResult> {
  const claims = (dependencies.claims ?? currentAccountClaims)()
  if (!claims) return { kind: 'not-authenticated' }
  // Persist before starting network work: a reload can interrupt the first attempt.
  addPending({ subject: claims.subject, localBookId: input.localBookId, ...(input.sourcePartNumber ? { sourcePartNumber: input.sourcePartNumber } : {}), title: input.title, author: input.author, ...(input.category ? { category: input.category } : {}),...(input.wordCompanion?{wordCompanion:true}:{}),...(input.imageBook?{imageBook:true}:{}) }, targetStorage(dependencies))
  try {
    const { localBookId: _localBookId, sourcePartNumber: _sourcePartNumber, wordCompanion,imageBook, ...upload } = input
    const needsStored=Boolean(imageBook||wordCompanion||/\.html?$/iu.test(input.file.name))
    const stored=needsStored?await (dependencies.loadBook??getBook)(input.localBookId):undefined
    const assets=imageBook?imageAssets(stored):wordCompanion?await companionAssets(stored,dependencies):htmlResources(stored)
    assertMirrorSession(dependencies,claims)
    const uploaded = await (dependencies.submit ?? submitAccountBook)({...upload,...assets})
    removePending(claims.subject, input.localBookId, input.sourcePartNumber, targetStorage(dependencies))
    // The server acknowledged the old owner's upload: retire its queue entry,
    // but never expose that receipt to a newly selected account/session.
    if (!sameMirrorSession(dependencies, claims)) return { kind: 'session-changed' }
    return { kind: 'uploaded', accountBookId: uploaded.id }
  } catch (error) {
    return { kind: 'local-only', error }
  }
}

/** Retries only entries owned by the currently authenticated account. */
export async function retryPendingAccountBookMirrors(dependencies: MirrorDependencies = {}): Promise<{ uploaded: number; remaining: number }> {
  const claims = (dependencies.claims ?? currentAccountClaims)()
  if (!claims) return { uploaded: 0, remaining: 0 }
  const storage = targetStorage(dependencies), key = storage ?? absentStorage
  let flights = retryFlights.get(key)
  if (!flights) { flights = new Map(); retryFlights.set(key, flights) }
  const flightKey = JSON.stringify([claims.subject, claims.sessionId])
  const active = flights.get(flightKey)
  if (active) return active
  // Publish the flight before reading local data so simultaneous online/import events share it.
  const flight = Promise.resolve().then(() => retryAccountQueue(dependencies, claims, storage))
  flights.set(flightKey, flight)
  try { return await flight }
  finally { if (flights.get(flightKey) === flight) flights.delete(flightKey) }
}

async function retryAccountQueue(dependencies: MirrorDependencies, claims: AccountClaims, storage: Pick<Storage, 'getItem' | 'setItem'> | undefined): Promise<RetryResult> {
  const pending = readQueue(storage).filter(item => item.subject === claims.subject)
  let uploaded = 0
  for (const item of pending) {
    if (!sameMirrorSession(dependencies, claims)) break
    let book: StoredBook | undefined
    try { book = await (dependencies.loadBook ?? getBook)(item.localBookId) }
    catch { continue } // A transient storage error does not mean the book was deleted.
    // Reading the source is asynchronous; the account may have changed meanwhile.
    if (!sameMirrorSession(dependencies, claims)) break
    if (!book) { removePending(item.subject, item.localBookId, item.sourcePartNumber, storage); continue }
    const part = item.sourcePartNumber ? book.volumes?.find(volume => volume.number === item.sourcePartNumber) : undefined
    if (item.sourcePartNumber && !part) { removePending(item.subject, item.localBookId, item.sourcePartNumber, storage); continue }
    const bytes = part ? (part.sourceData ?? part.data) : (book.sourceData ?? book.data)
    const file = new File([new Uint8Array(bytes).buffer], part?.fileName ?? book.fileName, { type: part?.sourceMimeType ?? part?.mimeType ?? book.sourceMimeType ?? book.mimeType })
    try {
      const assets=item.imageBook||book.sourceFormat==='jpeg'?imageAssets(book):item.wordCompanion||book.pdfEngine==='microsoft-word-companion-v1'?await companionAssets(book,dependencies):htmlResources(book)
      assertMirrorSession(dependencies,claims)
      await (dependencies.submit ?? submitAccountBook)({ file, title: item.title, author: item.author, ...(item.category ? { category: item.category } : {}),...assets })
      removePending(item.subject, item.localBookId, item.sourcePartNumber, storage)
      if (!sameMirrorSession(dependencies, claims)) break
      uploaded++
    } catch { /* Retain it for the next online attempt. */ }
  }
  if (!sameMirrorSession(dependencies, claims)) return { uploaded: 0, remaining: 0 }
  return { uploaded, remaining: readQueue(storage).filter(item => item.subject === claims.subject).length }
}

function sameMirrorSession(dependencies:MirrorDependencies,expected:AccountClaims):boolean{
 const active=(dependencies.claims??currentAccountClaims)()
 return Boolean(active&&active.subject===expected.subject&&active.sessionId===expected.sessionId)
}
function imageAssets(book:StoredBook|undefined){
 if(!book||book.sourceFormat!=='jpeg'||!book.pdfData?.length||book.pdfStatus!=='ready')throw Error('jpeg_reading_pdf_missing')
 return centralBookUploadInput({localBookId:book.id,metadata:book,files:[],book})
}
function htmlResources(book:StoredBook|undefined){
 if(book?.sourceFormat!=='html'||!book.htmlAssets?.length)return {}
 return {htmlResources:book.htmlAssets.map(asset=>({path:asset.path,file:new File([Uint8Array.from(asset.data)],asset.path.split('/').at(-1)!,{type:asset.mimeType})}))}
}
function assertMirrorSession(dependencies:MirrorDependencies,expected:AccountClaims):void{
 if(!sameMirrorSession(dependencies,expected))throw Error('account_session_changed')
}
async function companionAssets(book:StoredBook|undefined,dependencies:MirrorDependencies){
 if(!book||book.pdfEngine!=='microsoft-word-companion-v1')throw Error('invalid_word_bundle')
 const bundle=await (dependencies.prepareBundle??createWordBundleUpload)(book)
 if(!bundle)throw Error('invalid_word_bundle')
 return {...bundle,file:new File([Uint8Array.from(book.data)],book.fileName,{type:book.mimeType})}
}
function targetStorage(dependencies: MirrorDependencies): Pick<Storage, 'getItem' | 'setItem'> | undefined { return dependencies.storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage) }
function readQueue(storage?: Pick<Storage, 'getItem' | 'setItem'>): PendingMirror[] {
  try { const parsed = JSON.parse(storage?.getItem(QUEUE_KEY) ?? '[]') as unknown; return Array.isArray(parsed) ? parsed.filter(validPending).slice(-MAX_QUEUE_ITEMS) : [] } catch { return [] }
}
function validPending(value: unknown): value is PendingMirror {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<PendingMirror>
  return typeof item.subject === 'string' && item.subject.length > 0 && item.subject.length <= 240 && typeof item.localBookId === 'string' && item.localBookId.length > 0 && item.localBookId.length <= 200 && (item.sourcePartNumber === undefined || (Number.isSafeInteger(item.sourcePartNumber) && Number(item.sourcePartNumber) > 0 && Number(item.sourcePartNumber) <= 10_000)) && typeof item.title === 'string' && item.title.length > 0 && item.title.length <= 500 && typeof item.author === 'string' && item.author.length > 0 && item.author.length <= 500 && (item.category === undefined || (typeof item.category === 'string' && item.category.length <= 200))
}
function writeQueue(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined, items: PendingMirror[]): void { try { storage?.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE_ITEMS))) } catch { /* The local book remains intact. */ } }
function sameSource(item: PendingMirror, subject: string, localBookId: string, part?: number): boolean { return item.subject === subject && item.localBookId === localBookId && item.sourcePartNumber === part }
function addPending(item: PendingMirror, storage?: Pick<Storage, 'getItem' | 'setItem'>): void { writeQueue(storage, [...readQueue(storage).filter(existing => !sameSource(existing, item.subject, item.localBookId, item.sourcePartNumber)), item]) }
function removePending(subject: string, localBookId: string, part: number | undefined, storage?: Pick<Storage, 'getItem' | 'setItem'>): void { writeQueue(storage, readQueue(storage).filter(item => !sameSource(item, subject, localBookId, part))) }

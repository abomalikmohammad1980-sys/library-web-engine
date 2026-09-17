export type SmartSearchTransport = 'local' | 'cloud'
export type SmartSearchProvider = 'openai' | 'anthropic' | 'google' | 'custom'
export type SmartSearchMode = 'lexical' | 'semantic' | 'hybrid'
export type SmartSearchPermission = 'library.search' | 'content.remote' | 'account.context'
export type SmartSearchTool = 'local_search' | 'fetch_passages' | 'resolve_citation'

export interface SmartSearchProviderSelection {
  provider: SmartSearchProvider
  model: string
  endpoint?: string
}

export interface SmartSearchPrivacyGrant {
  permissions: SmartSearchPermission[]
  /** Explicit per-request consent. It is never inferred from a saved provider key. */
  remoteContentConsent: boolean
  includeAccountContext: boolean
}

export interface SmartSearchRequest {
  schemaVersion: 1
  requestId: string
  query: string
  mode: SmartSearchMode
  transport: SmartSearchTransport
  provider?: SmartSearchProviderSelection
  privacy: SmartSearchPrivacyGrant
  page: { limit: number; cursor?: string }
  corpus: { estimatedBookCount: number; bookIds?: string[]; shardHint?: string }
  allowedTools: SmartSearchTool[]
}

export interface SmartSearchCitation {
  citationId: string
  bookId: string
  passageId: string
  quote: string
  location: { page: number; part?: number }
  source: { checksum: string; tool: SmartSearchTool }
}

export interface SmartSearchHit {
  hitId: string
  score: number
  citationIds: string[]
}

export interface SmartSearchResponse {
  schemaVersion: 1
  requestId: string
  answer?: string
  hits: SmartSearchHit[]
  citations: SmartSearchCitation[]
  nextCursor?: string
}

export type ContractResult<T> = { ok: true; value: T } | { ok: false; errors: string[] }

const requestKeys = new Set(['schemaVersion','requestId','query','mode','transport','provider','privacy','page','corpus','allowedTools'])
const providers = new Set<SmartSearchProvider>(['openai','anthropic','google','custom'])
const modes = new Set<SmartSearchMode>(['lexical','semantic','hybrid'])
const permissions = new Set<SmartSearchPermission>(['library.search','content.remote','account.context'])
const tools = new Set<SmartSearchTool>(['local_search','fetch_passages','resolve_citation'])

function record(value: unknown): value is Record<string,unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function safeToken(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f]/u.test(value)
}

export function validateSmartSearchRequest(value: unknown): ContractResult<SmartSearchRequest> {
  const errors: string[] = []
  if (!record(value)) return { ok:false, errors:['request must be an object'] }
  for (const key of Object.keys(value)) if (!requestKeys.has(key)) errors.push(`unknown request field: ${key}`)
  if (value.schemaVersion !== 1) errors.push('unsupported schemaVersion')
  if (!safeToken(value.requestId,128)) errors.push('invalid requestId')
  if (typeof value.query !== 'string' || !value.query.trim() || value.query.length > 2000) errors.push('invalid query')
  if (!modes.has(value.mode as SmartSearchMode)) errors.push('invalid mode')
  if (value.transport !== 'local' && value.transport !== 'cloud') errors.push('invalid transport')

  const privacy = record(value.privacy) ? value.privacy : undefined
  const granted = Array.isArray(privacy?.permissions) && privacy.permissions.every(item=>permissions.has(item as SmartSearchPermission))
  const permissionList = Array.isArray(privacy?.permissions) ? privacy.permissions : []
  if (!privacy || !granted || new Set(permissionList).size !== permissionList.length) errors.push('invalid permissions')
  if (typeof privacy?.remoteContentConsent !== 'boolean' || typeof privacy?.includeAccountContext !== 'boolean') errors.push('invalid privacy grant')
  if (privacy?.includeAccountContext && !(privacy.permissions as unknown[]).includes('account.context')) errors.push('account context permission required')

  const provider = record(value.provider) ? value.provider : undefined
  if (value.transport === 'local' && value.provider !== undefined) errors.push('local transport must not select a remote provider')
  if (value.transport === 'cloud') {
    if (!provider || !providers.has(provider.provider as SmartSearchProvider) || !safeToken(provider.model,160)) errors.push('valid cloud provider required')
    if (privacy?.remoteContentConsent !== true || !(privacy?.permissions as unknown[] | undefined)?.includes('content.remote')) errors.push('explicit remote content consent required')
    if (provider?.provider === 'custom' && (!safeToken(provider.endpoint,500) || !/^https:\/\//u.test(provider.endpoint))) errors.push('custom provider requires an https endpoint')
    if (provider?.provider !== 'custom' && provider?.endpoint !== undefined) errors.push('built-in providers must not override endpoints')
  }

  const page = record(value.page) ? value.page : undefined
  if (!page || !Number.isInteger(page.limit) || Number(page.limit) < 1 || Number(page.limit) > 50) errors.push('page limit must be between 1 and 50')
  if (page?.cursor !== undefined && !safeToken(page.cursor,2048)) errors.push('invalid cursor')
  const corpus = record(value.corpus) ? value.corpus : undefined
  if (!corpus || !Number.isSafeInteger(corpus.estimatedBookCount) || Number(corpus.estimatedBookCount) < 0) errors.push('invalid corpus estimate')
  if (corpus?.bookIds !== undefined && (!Array.isArray(corpus.bookIds) || corpus.bookIds.length > 1000 || !corpus.bookIds.every(id=>safeToken(id,128)))) errors.push('invalid book filter')
  if (corpus?.shardHint !== undefined && !safeToken(corpus.shardHint,256)) errors.push('invalid shard hint')
  if (!Array.isArray(value.allowedTools) || value.allowedTools.length === 0 || value.allowedTools.some(tool=>!tools.has(tool as SmartSearchTool))) errors.push('invalid tool allow-list')
  return errors.length ? { ok:false, errors } : { ok:true, value:value as unknown as SmartSearchRequest }
}

export function validateSmartSearchResponse(value: unknown, request: SmartSearchRequest): ContractResult<SmartSearchResponse> {
  const errors: string[] = []
  if (!record(value)) return { ok:false, errors:['response must be an object'] }
  if (value.schemaVersion !== 1 || value.requestId !== request.requestId) errors.push('response identity mismatch')
  if (value.answer !== undefined && (typeof value.answer !== 'string' || value.answer.length > 20000)) errors.push('invalid answer')
  if (!Array.isArray(value.citations) || !Array.isArray(value.hits)) return { ok:false, errors:[...errors,'hits and citations are required'] }
  if (value.hits.length > request.page.limit) errors.push('response exceeds requested page size')
  const citationIds = new Set<string>()
  for (const raw of value.citations) {
    if (!record(raw) || !safeToken(raw.citationId,128) || citationIds.has(raw.citationId)) { errors.push('invalid or duplicate citation'); continue }
    citationIds.add(raw.citationId)
    const location=record(raw.location)?raw.location:undefined, source=record(raw.source)?raw.source:undefined
    if (!safeToken(raw.bookId,128) || !safeToken(raw.passageId,256) || typeof raw.quote !== 'string' || !raw.quote.trim() || raw.quote.length > 2000) errors.push('invalid citation content')
    if (!location || !Number.isInteger(location.page) || Number(location.page)<1 || (location.part!==undefined&&(!Number.isInteger(location.part)||Number(location.part)<1))) errors.push('invalid citation location')
    if (!source || !safeToken(source.checksum,256) || !tools.has(source.tool as SmartSearchTool) || !request.allowedTools.includes(source.tool as SmartSearchTool)) errors.push('untrusted citation source')
  }
  for (const raw of value.hits) {
    if (!record(raw) || !safeToken(raw.hitId,128) || typeof raw.score !== 'number' || raw.score<0 || raw.score>1 || !Array.isArray(raw.citationIds) || raw.citationIds.length===0 || raw.citationIds.some(id=>typeof id!=='string'||!citationIds.has(id))) errors.push('uncited or invalid hit')
  }
  if (value.answer && value.hits.length===0) errors.push('answer requires cited hits')
  if (value.nextCursor !== undefined && !safeToken(value.nextCursor,2048)) errors.push('invalid next cursor')
  return errors.length ? {ok:false,errors} : {ok:true,value:value as unknown as SmartSearchResponse}
}

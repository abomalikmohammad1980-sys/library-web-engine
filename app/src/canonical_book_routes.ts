export interface BookSourceIdentity {
  publicId: string
  sourceKind: string
  sourceId: string
}

export interface CanonicalBookRoute extends BookSourceIdentity {
  slug: string
  aliases: readonly string[]
}

export interface CanonicalBookRouteRequest extends BookSourceIdentity {
  /** A reviewed, stable ASCII slug. This module deliberately does not transliterate titles. */
  requestedSlug: string
}

const ROUTE_SLUG = /^[0-9]+-[a-z0-9]+(?:-[a-z0-9]+)*$/u

function identityKey(value: BookSourceIdentity): string {
  const parts=[value.publicId,value.sourceKind,value.sourceId]
  if (parts.some(part=>!part.trim()||part!==part.trim()||part.includes('\u0000'))) {
    throw new Error('canonical_book_route_identity_invalid')
  }
  return `${value.sourceKind}\u0000${value.sourceId}`
}

function requireSlug(value: string): string {
  if (!ROUTE_SLUG.test(value)) throw new Error('canonical_book_route_slug_invalid')
  return value
}

/**
 * Allocates reviewed canonical slugs without deriving them from mutable titles.
 * Existing canonical slugs and aliases remain reserved forever within the supplied registry.
 */
export function allocateCanonicalBookRoutes(
  existing: readonly CanonicalBookRoute[],
  requests: readonly CanonicalBookRouteRequest[],
): CanonicalBookRoute[] {
  const byIdentity = new Map<string, CanonicalBookRoute>()
  const byPublicId = new Map<string, string>()
  const reserved = new Map<string, string>()

  const reserve = (slug: string, owner: string): void => {
    const previous = reserved.get(requireSlug(slug))
    if (previous && previous !== owner) throw new Error('canonical_book_route_slug_collision')
    reserved.set(slug, owner)
  }

  for (const entry of existing) {
    const key = identityKey(entry)
    if (byIdentity.has(key)) throw new Error('canonical_book_route_identity_collision')
    const priorIdentity = byPublicId.get(entry.publicId)
    if (priorIdentity && priorIdentity !== key) throw new Error('canonical_book_route_public_id_collision')
    byPublicId.set(entry.publicId, key)
    const aliases = [...new Set(entry.aliases)]
    if (aliases.includes(entry.slug)) throw new Error('canonical_book_route_alias_invalid')
    reserve(entry.slug, key)
    for (const alias of aliases) reserve(alias, key)
    const stable = Object.freeze({ ...entry, aliases: Object.freeze(aliases) })
    byIdentity.set(key, stable)
  }

  for (const request of requests) {
    const key = identityKey(request)
    const priorPublicIdentity = byPublicId.get(request.publicId)
    if (priorPublicIdentity && priorPublicIdentity !== key) throw new Error('canonical_book_route_public_id_collision')
    const current = byIdentity.get(key)
    if (current) {
      if (current.publicId !== request.publicId) throw new Error('canonical_book_route_public_id_changed')
      if (current.slug !== request.requestedSlug) throw new Error('canonical_book_route_slug_changed')
      continue
    }
    reserve(request.requestedSlug, key)
    const allocated = Object.freeze({
      publicId: request.publicId,
      sourceKind: request.sourceKind,
      sourceId: request.sourceId,
      slug: request.requestedSlug,
      aliases: Object.freeze([] as string[]),
    })
    byIdentity.set(key, allocated)
    byPublicId.set(request.publicId, key)
  }

  return [...byIdentity.values()].sort((left, right) => left.publicId.localeCompare(right.publicId, 'en'))
}

/**
 * Adds reviewed legacy slugs to an existing route without changing its permanent
 * public identity or canonical slug. All canonical slugs and aliases stay reserved.
 */
export function addCanonicalBookRouteAliases(
  registry: readonly CanonicalBookRoute[],
  publicId: string,
  aliases: readonly string[],
): CanonicalBookRoute[] {
  const stable = allocateCanonicalBookRoutes(registry, [])
  const target = stable.find(route => route.publicId === publicId)
  if (!target) throw new Error('canonical_book_route_not_found')

  const owners = new Map<string, string>()
  for (const route of stable) {
    owners.set(route.slug, route.publicId)
    for (const alias of route.aliases) owners.set(alias, route.publicId)
  }

  const nextAliases = [...new Set([...target.aliases, ...aliases])]
  for (const alias of nextAliases) {
    requireSlug(alias)
    if (alias === target.slug) throw new Error('canonical_book_route_alias_invalid')
    const owner = owners.get(alias)
    if (owner && owner !== publicId) throw new Error('canonical_book_route_slug_collision')
  }

  return stable.map(route => route.publicId === publicId
    ? Object.freeze({ ...route, aliases: Object.freeze(nextAliases) })
    : route)
}
export function resolveCanonicalBookDeepLink(
  registry: readonly CanonicalBookRoute[],
  slug: string,
  query = '',
): { publicId: string; canonicalHash?: string } | undefined {
  const resolved = resolveCanonicalBookRoute(registry, slug)
  if (!resolved) return undefined
  return {
    publicId: resolved.route.publicId,
    ...(resolved.canonical ? {} : {
      canonicalHash: '#/book/' + resolved.route.slug + (query ? '?' + query.replace(/^\?/, '') : ''),
    }),
  }
}
export function resolveCanonicalBookRoute(
  registry: readonly CanonicalBookRoute[],
  slug: string,
): { route: CanonicalBookRoute; canonical: boolean } | undefined {
  for (const route of registry) {
    if (route.slug === slug) return { route, canonical: true }
    if (route.aliases.includes(slug)) return { route, canonical: false }
  }
  return undefined
}



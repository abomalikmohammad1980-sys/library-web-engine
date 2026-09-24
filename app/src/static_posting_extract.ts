export type StaticPosting = [string, number[], number | undefined, string]

/** Return only the requested term, not the unrelated words sharing its bucket. */
export function extractStaticPosting(bytes: ArrayBuffer, word: string): StaticPosting[] {
  const value = JSON.parse(new TextDecoder().decode(bytes)) as { entries?: Array<[string, StaticPosting[]]> }
  if (!Array.isArray(value.entries)) throw Error('shamela_static_posting_invalid')
  return value.entries.find(entry => entry[0] === word)?.[1] ?? []
}

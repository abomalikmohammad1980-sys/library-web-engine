/** Preserve the normalization contract used by the published heading index. */
export const HEADING_RELEASE_NORMALIZER_SOURCE_SHA = '52ec6091d90d87867f439e6dac8d23c8bec6cec44c799a45df00a94aff739297'

export function normalizeHeadingReleaseText(value: string): string {
  return value.toLocaleLowerCase('ar')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/\s+/gu, ' ')
}

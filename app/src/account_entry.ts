/** Keep return destinations inside the hash router, never on an external origin. */
export function accountEntryHref(hash: string): string {
  return `#/account/sign-in?returnTo=${encodeURIComponent(hash.startsWith('#/') && !hash.startsWith('#/account/sign-in') ? hash : '#/me')}`
}

export function accountEntryReturn(hash: string): string | null {
  if (!hash.startsWith('#/account/sign-in?')) return null
  const target = new URLSearchParams(hash.slice(hash.indexOf('?') + 1)).get('returnTo')
  return target?.startsWith('#/') && !target.startsWith('#/account/sign-in') && !/[\r\n\\]/.test(target) ? target : '#/me'
}

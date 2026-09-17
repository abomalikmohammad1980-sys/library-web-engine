export function prefersReducedMotion(
  scope: Pick<Window, 'matchMedia'> | undefined = typeof window === 'undefined' ? undefined : window,
  root: Pick<Document, 'documentElement'> | undefined = typeof document === 'undefined' ? undefined : document,
): boolean {
  return Boolean(
    root?.documentElement?.classList.contains('a11y-reduce-motion')
    || scope?.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
}

export function readerScrollBehavior(scope?: Pick<Window, 'matchMedia'>, root?: Pick<Document, 'documentElement'>): ScrollBehavior {
  return prefersReducedMotion(scope, root) ? 'auto' : 'smooth'
}

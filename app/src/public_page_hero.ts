import { brandMark } from './brand'
import { h, type Child } from './ui'

export interface PublicPageHeroOptions {
  eyebrow: string
  title: string
  description?: string
  titleId: string
  className?: string
  after?: Child[]
}

/** هوية موحّدة لرؤوس صفحات الخِزانة العامة، من دون المساس برؤوس الأقسام المتخصصة. */
export function publicPageHero(options: PublicPageHeroOptions): HTMLElement {
  return h('section', {
    class: `public-page-hero${options.className ? ` ${options.className}` : ''}`,
    'aria-labelledby': options.titleId,
  },
  h('div', { class: 'public-page-hero__identity', 'aria-hidden': 'true' }, brandMark('public-page-hero__mark brand-mark'), h('span', null, 'الخِزانة')),
  h('div', { class: 'public-page-hero__copy' },
    options.eyebrow ? h('p', { class: 'page-eyebrow' }, options.eyebrow) : undefined,
    h('h1', { class: 'page-title', id: options.titleId }, options.title),
    options.description ? h('p', { class: 'page-sub' }, options.description) : undefined,
    ...(options.after ?? []),
  ))
}

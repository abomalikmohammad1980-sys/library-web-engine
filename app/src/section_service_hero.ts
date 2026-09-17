import { h } from './ui'
import { icon, type IconName } from './icons'

export interface SectionServiceHeroOptions {
  title: string
  subtitle?: string
  description: string
  titleId: string
  className?: string
  variant: 'library' | 'authors' | 'search'
}

function heroIllustration(side: 'start' | 'end', variant: SectionServiceHeroOptions['variant']): HTMLElement {
  const libraryIcons: [IconName, IconName] = side === 'start' ? ['book', 'bookmark'] : ['download', 'box']
  const authorIcons: [IconName, IconName] = side === 'start' ? ['person', 'book'] : ['person', 'list']
  const searchIcons: [IconName, IconName] = side === 'start' ? ['search', 'book'] : ['list', 'search']
  const [primary, secondary] = variant === 'library' ? libraryIcons : variant === 'authors' ? authorIcons : searchIcons
  return h('div', {
    class: `section-service-hero__illustration section-service-hero__illustration--${side}`,
    'aria-hidden': 'true',
  }, icon(primary, 64, 'section-service-hero__illustration-primary'), icon(secondary, 25, 'section-service-hero__illustration-detail'))
}

/** رأس موحّد لبوابات أقسام الخِزانة ذات العنوان الخدمي ذي المستويين. */
export function sectionServiceHero(options: SectionServiceHeroOptions): HTMLElement {
  return h('section', {
    class: `section-service-hero section-service-hero--${options.variant}${options.className ? ` ${options.className}` : ''}`,
    'aria-labelledby': options.titleId,
  },
  heroIllustration('start', options.variant),
  h('div', { class: 'section-service-hero__copy' },
    h('h1', { class: 'section-service-hero__title', id: options.titleId }, options.title),
    options.subtitle ? h('p', { class: 'section-service-hero__subtitle' }, options.subtitle) : undefined,
    h('p', { class: 'section-service-hero__description' }, options.description)),
  heroIllustration('end', options.variant))
}

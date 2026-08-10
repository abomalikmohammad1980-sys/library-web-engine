import { icon, type IconName } from './icons'
import { h } from './ui'

export type StateKind = 'loading' | 'empty' | 'no-results' | 'error'

export interface StateSemantics {
  role: 'status' | 'alert'
  live: 'polite' | 'assertive'
  busy: boolean
}

export function stateSemantics(kind: StateKind): StateSemantics {
  return kind === 'error'
    ? { role: 'alert', live: 'assertive', busy: false }
    : { role: 'status', live: 'polite', busy: kind === 'loading' }
}

export interface StateViewOptions {
  kind: StateKind
  title: string
  description?: string
  icon?: IconName
  actionLabel?: string
  onAction?: () => void
  href?: string
  compact?: boolean
  titleId?: string
}

export function stateView(options: StateViewOptions): HTMLElement {
  const semantics = stateSemantics(options.kind)
  const root = h('div', { class: `state-view state-view--${options.kind}${options.compact ? ' state-view--compact' : ''}`, role: semantics.role, 'aria-live': semantics.live },
    h('span', { class: 'state-view__icon', 'aria-hidden': 'true' }, icon(options.icon ?? (options.kind === 'error' ? 'close' : options.kind === 'loading' ? 'clock' : 'search'), 25)),
    h('strong', options.titleId ? { id: options.titleId } : null, options.title),
    ...(options.description ? [h('p', null, options.description)] : []),
  )
  root.setAttribute('aria-busy', String(semantics.busy))
  root.dataset.state = options.kind
  if (options.actionLabel) {
    const action = options.href ? h('a', { class: 'btn btn--secondary', href: options.href }, options.actionLabel) : h('button', { class: 'btn btn--secondary', type: 'button' }, options.actionLabel)
    if (!options.href && options.onAction) action.addEventListener('click', options.onAction)
    root.appendChild(action)
  }
  return root
}

/** يبدل حالة مضيف سبق إنشاؤه من دون تكديس state-view داخل state-view. */
export function mountStateView(host: HTMLElement, options: StateViewOptions): void {
  const view = stateView(options)
  host.className = view.className
  host.setAttribute('role', view.getAttribute('role') ?? 'status')
  host.setAttribute('aria-live', view.getAttribute('aria-live') ?? 'polite')
  host.setAttribute('aria-busy', view.getAttribute('aria-busy') ?? 'false')
  host.dataset.state = options.kind
  host.replaceChildren(...view.childNodes)
}

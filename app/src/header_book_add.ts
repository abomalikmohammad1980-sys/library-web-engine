import { icon } from './icons'
import { h, toast } from './ui'
import { makeProgrammaticFileInput } from './programmatic_file_input'

export function headerBookAddControl(): HTMLElement {
  const wrap = h('div', { class: 'header-book-add' })
  const trigger = h('button', { type: 'button', class: 'header-book-add__trigger', 'aria-label': 'إضافة كتاب أو مجلد', title: 'إضافة كتاب أو مجلد' },
    h('span', { class: 'header-book-add__icon', 'aria-hidden': 'true' }, icon('book', 20), icon('plus', 11))) as HTMLButtonElement
  const menu = h('div', { class: 'header-book-add__menu', role: 'menu', hidden: true, 'aria-label': 'خيارات الإضافة' },
    h('button', { type: 'button', role: 'menuitem' }, icon('book', 18), 'إضافة كتاب'),
    h('button', { type: 'button', role: 'menuitem' }, icon('box', 18), 'إضافة مجموعة'))
  const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
  const fileInput = makeProgrammaticFileInput(h('input', { type: 'file', accept: '.docx,.doc,.rtf,.pdf,.epub,.bok,.txt,.md' }) as HTMLInputElement)
  const folderInput = makeProgrammaticFileInput(h('input', { type: 'file' }) as HTMLInputElement)
  folderInput.setAttribute('webkitdirectory', '')
  fileInput.multiple = folderInput.multiple = true
  // Keep the native picker inside the user gesture; load the heavy importer only after selection.
  items[0]?.addEventListener('click', () => fileInput.click())
  items[1]?.addEventListener('click', () => folderInput.click())
  for (const input of [fileInput, folderInput]) input.addEventListener('change', () => {
    const files = Array.from(input.files ?? [])
    input.value = ''
    if (!files.length) return
    void import('./quick_book_import').then(module => { if (wrap.isConnected) module.openQuickBookImport(files, trigger) }).catch(() => { if (wrap.isConnected) toast('تعذّر فتح الإضافة؛ أعد المحاولة.') })
  })
  trigger.setAttribute('aria-haspopup', 'menu')
  trigger.setAttribute('aria-expanded', 'false')
  trigger.setAttribute('aria-controls', 'header-book-add-menu')
  menu.id = 'header-book-add-menu'
  const close = (restoreFocus = false): void => { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); if (restoreFocus) trigger.focus() }
  const open = (focusItem = false): void => { menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); if (focusItem) items[0]?.focus() }
  trigger.addEventListener('click', () => menu.hidden ? open() : close())
  trigger.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(true) }
    else if (event.key === 'Escape') { event.preventDefault(); close(true) }
  })
  menu.addEventListener('keydown', event => {
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') { event.preventDefault(); close(true); return }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    items[(index + step + items.length) % items.length]?.focus()
  })
  menu.addEventListener('click', event => { if ((event.target as Element).closest('[role="menuitem"]')) close() })
  const outside = (event: PointerEvent): void => {
    if (!wrap.isConnected) { document.removeEventListener('pointerdown', outside); return }
    if (!wrap.contains(event.target as Node)) close()
  }
  document.addEventListener('pointerdown', outside)
  wrap.append(trigger, menu, fileInput, folderInput)
  return wrap
}

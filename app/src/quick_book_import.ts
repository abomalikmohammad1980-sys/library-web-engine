import { bookImportManager } from './book_import'
import { h } from './ui'
import { icon } from './icons'

/** Reuse the library review/save journey without changing the current route. */
export function openQuickBookImport(files: File[], returnFocus: HTMLElement): void {
  const dialog = h('dialog', { class: 'quick-book-import', 'aria-label': 'إضافة كتب إلى مكتبتي' }) as HTMLDialogElement
  const close = h('button', { type: 'button', class: 'btn btn--secondary', title: 'إغلاق', 'aria-label': 'إغلاق' }, icon('close', 20))
  close.addEventListener('click', () => dialog.close())
  const importer = bookImportManager(() => window.dispatchEvent(new Event('library-changed')), { hideLauncher: true, initialFiles: files })
  dialog.append(h('header', { class: 'quick-book-import__head' }, h('h2', null, 'إضافة كتب إلى مكتبتي'), close), importer)
  dialog.addEventListener('close', () => { dialog.remove(); if (returnFocus.isConnected) returnFocus.focus() }, { once: true })
  document.body.append(dialog)
  dialog.showModal()
}

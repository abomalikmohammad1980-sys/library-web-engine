/** يخفي حقل الملف الذي يفتحه زر مسمى مستقل عن الترتيب وشجرة الوصول. */
export function makeProgrammaticFileInput(input: HTMLInputElement): HTMLInputElement {
  input.hidden = true
  input.tabIndex = -1
  input.setAttribute('aria-hidden', 'true')
  return input
}

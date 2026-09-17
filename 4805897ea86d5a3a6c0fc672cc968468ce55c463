/**
 * يحوّل حقول البحث العامة إلى بوابة للبحث المركزي.
 * لا نعرض قائمة نتائج مصغرة؛ الفلاتر والترتيب والسياق موضعها شاشة البحث.
 */
export function attachLiveSearch(input: HTMLInputElement, host: HTMLElement): void {
  const openCentralSearch = (): void => {
    const query = input.value.trim()
    if (query.length < 2) {
      input.focus()
      input.setCustomValidity(query ? 'اكتب حرفين على الأقل' : 'اكتب كلمة أو عبارة للبحث')
      input.reportValidity()
      return
    }
    input.setCustomValidity('')
    location.hash = `#/search?q=${encodeURIComponent(query)}`
  }

  input.placeholder = 'اكتب ثم اضغط Enter للبحث الشامل…'
  input.addEventListener('input', () => input.setCustomValidity(''))
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); openCentralSearch() }
    if (event.key === 'Escape') { input.value = ''; input.setCustomValidity(''); input.blur() }
  })
  host.addEventListener('click', event => {
    const target = event.target as Element
    if (target.closest('svg') && !target.closest('button, a')) openCentralSearch()
  })
}

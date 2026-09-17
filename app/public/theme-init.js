// Intentionally parser-blocking and same-origin: apply the saved theme before
// the app and its first paint without enabling inline scripts in CSP.
(() => {
  let theme = 'original';
  try {
    const saved = JSON.parse(localStorage.getItem('alkhizana:settings:v1') || '{}');
    if (saved && ['light', 'dark', 'sepia'].includes(saved.theme)) theme = saved.theme;
  } catch {}
  document.documentElement.dataset.appTheme = theme;
  document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = {original:'#f1ede3', light:'#ffffff', dark:'#171816', sepia:'#eadcc3'}[theme];
})();

// Same bounded handoff for visitors and crawlers. Without JavaScript the
// server document stays readable; a failed app boot also restores it.
(() => {
  const html = document.documentElement;
  if (!html.classList || typeof MutationObserver === 'undefined') return;
  html.classList.add('app-boot-pending');
  let observer;
  const finish = () => { html.classList.remove('app-boot-pending'); observer?.disconnect(); clearTimeout(timer); };
  const timer = setTimeout(finish, 8000);
  observer = new MutationObserver(() => {
    const app = document.getElementById('app');
    if (app?.children.length && !app.querySelector('.seo-page')) finish();
  });
  observer.observe(html, {childList:true, subtree:true});
})();

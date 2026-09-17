// Critical styles travel with the server HTML: readable before JavaScript/CSS
// loads, and still useful when JavaScript is disabled. The bounded JS handoff
// prevents flashing a different layout; boot failure restores this document.
export const seoPresentation = `<style id="seo-presentation">
.seo-page{box-sizing:border-box;direction:rtl;max-width:1180px;margin:32px auto;padding:clamp(20px,4vw,48px);font-family:var(--font-ui,Tahoma),sans-serif;line-height:1.9;color:var(--ink-default,#292720);background:var(--surface-card,#fffdf8);border:1px solid var(--border-default,#e6e1d6);border-radius:24px}
.seo-page h1{font-family:var(--font-serif-display,Tahoma),serif;font-size:clamp(26px,4vw,44px);line-height:1.5;margin:0 0 16px;text-wrap:balance}
.seo-page p{max-width:75ch;margin:12px 0}.seo-page a{color:var(--brand-primary,#2f6f54);text-underline-offset:4px;overflow-wrap:anywhere}
.seo-page nav{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}.seo-page nav a{padding:8px 16px;border:1px solid var(--border-default,#e6e1d6);border-radius:12px;text-decoration:none}
.seo-page ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px}.seo-page ul li{padding:16px;border:1px solid var(--border-default,#e6e1d6);border-radius:12px}.seo-page ol{padding-inline-start:24px}
.seo-page--home>h1,.seo-page--home>p{text-align:center;margin-inline:auto}.seo-page--home>nav{justify-content:center}
@media(max-width:600px){.seo-page{margin:12px;border-radius:16px}}
.app-boot-pending #app:has(>.seo-page){position:relative;min-height:70vh}
.app-boot-pending #app>.seo-page{visibility:hidden}
.app-boot-pending #app:has(>.seo-page)::before{content:"";position:absolute;inset:24px max(16px,calc((100% - 1100px)/2));height:220px;border-radius:20px;background:linear-gradient(var(--surface-card,#fffdf8),var(--surface-card,#fffdf8)) 0 0/100% 64px no-repeat,linear-gradient(var(--surface-card,#fffdf8),var(--surface-card,#fffdf8)) 0 92px/100% 128px no-repeat;pointer-events:none}
</style>`
export const seoNavLabels = {'/':'الرئيسية','/features':'ميزات الخزانة','/quran':'القرآن الكريم','/sunnah':'السنة النبوية','/authors':'المؤلفون','/browse':'تصفح الكتب','/new-books':'جديد الكتب'}

/** Exact entry CSS, in its existing cascade position. Keep the external asset
 * available for old SW caches; do not rewrite selectors or remove styles. */
export async function inlineEntryCss(html,readAsset){
 const tags=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)]
 if(tags.length!==1)throw Error('entry_css_tag_count')
 const tag=tags[0][0],path=/href="(\/assets\/[A-Za-z0-9_-]+\.css)"/.exec(tag)?.[1]
 if(!path)throw Error('entry_css_path_invalid')
 const css=await readAsset(path.slice(1))
 if(!css||Buffer.byteLength(css)>600000||/<\/style/i.test(css)||/@import\b/i.test(css))throw Error('entry_css_content_invalid')
 // Absolute emitted font/image URLs retain their meaning inside the document.
 if([...css.matchAll(/url\(([^)]*)\)/g)].some(([,raw])=>!/^['"]?(?:\/|data:|https:|#)/.test(raw.trim())))throw Error('entry_css_relative_url')
 return html.replace(tag,()=>'<style data-entry-css>'+css+'</style>')
}

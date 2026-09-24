import {createHash} from 'node:crypto'
/** Only static dependencies of the requested screen, never optional parsers. */
export function routePreloadHints(){return {name:'route-preload-hints',apply:'build',generateBundle(_options,bundle){
 const hints={}
 for(const name of ['home','quran','sunnah','library','reader','search','features']){
  const entry=Object.values(bundle).find(x=>x.type==='chunk'&&x.name===name&&x.isDynamicEntry)
  if(!entry)continue
  const seen=new Set(),visit=file=>{const chunk=bundle[file];if(!chunk||chunk.type!=='chunk'||chunk.isEntry||seen.has(file))return;seen.add(file);for(const dep of chunk.imports)visit(dep)}
  visit(entry.fileName);hints[name]=[...seen].map(x=>'/'+x)
 }
 const full=Object.values(bundle).find(x=>x.type==='chunk'&&x.name==='route_full_styles')
 if(full)hints.styles=[...(full.viteMetadata?.importedCss??[])].map(x=>'/'+x)
 this.emitFile({type:'asset',fileName:'route-preload-hints.json',source:JSON.stringify(hints)})
}}}
export function inlineRoutePreloads(index,headers,hints){
 for(const [key,paths] of Object.entries(hints))if(!/^[a-z]+$/.test(key)||!Array.isArray(paths)||paths.length>80||paths.some(x=>!(key==='styles'?/^\/assets\/[A-Za-z0-9_.-]+\.css$/:/^\/assets\/[A-Za-z0-9_.-]+\.js$/).test(x)))throw Error('invalid_route_preload_hints')
 const script=`(()=>{const h=${JSON.stringify(hints)};const p=(location.hash.startsWith('#/')?location.hash.slice(1):location.pathname).split('?')[0];const k=p.split('/')[1]||'home';const r=({authors:'library',author:'library',people:'library',books:'reader',book:'reader'})[k]||k;for(const href of h[r]||[]){if(document.querySelector('link[rel="modulepreload"][href="'+href+'"]'))continue;const l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href=href;document.head.append(l)}if(r!=='home')for(const href of h.styles||[]){const l=document.createElement('link');l.rel='preload';l.as='style';l.crossOrigin='';l.href=href;document.head.append(l)}})();`
 const hash="'sha256-"+createHash('sha256').update(script).digest('base64')+"'"
 if(!headers.includes('script-src ')||index.includes('data-route-preloads')||!index.includes('<script type="module"'))throw Error('invalid_preload_shell')
 // Before the stylesheet: a classic inline script after CSS waits for it.
 return {index:index.replace('<script type="module"','<script data-route-preloads>'+script+'</script><script type="module"'),headers:headers.replace(/script-src ([^;\r\n]+)/,(all,policy)=>policy.includes(hash)?all:all+' '+hash)}
}

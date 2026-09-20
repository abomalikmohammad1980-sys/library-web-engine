import postcss from 'postcss'
/** Keep all shared/home rules. Omit only rules requiring an exclusive screen
 * class; full original CSS is loaded before rendering any other route. */
export function initialScreenCss(source){
 const root=postcss.parse(source)
 const exclusive=/^(?:\[data-app-theme=['"][a-z]+['"]\]\s+)?\.(?:reader(?:[-_\s.#:[>+~]|$)|quran-|shelf-|shelves-|reading-plans-|research-projects-|book-profile__|library-page(?:[\s.#:[>+~]|$)|settings-page(?:[\s.#:[>+~]|$)|quality-)/
 root.walkRules(rule=>{if(rule.selector.split(',').every(selector=>exclusive.test(selector.trim())))rule.remove()})
 root.walkAtRules(rule=>{if(rule.nodes?.length===0&&['media','supports','container'].includes(rule.name))rule.remove()})
 return root.toString()
}
export function initialScreenCssPlugin(){return {name:'initial-screen-css',enforce:'pre',transform(code,id){
 if(!/\/(?:components|screens)\.css\?initial$/.test(id.replaceAll('\\','/')))return null
 return {code:initialScreenCss(code),map:null}
}}}

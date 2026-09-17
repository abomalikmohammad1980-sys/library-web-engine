export const SEARCH_BOOTSTRAP_PATH='./data/shamela-search-v2-packed.js'
/** The packed index is hosted separately; its configuration must execute before the app. */
export function wireSearchBootstrap(html){
 try{assertSearchBootstrap(html);return html}catch{/* Repair absent, late or duplicate configuration. */}
 const tag=`<script src="${SEARCH_BOOTSTRAP_PATH}"></script>`
 const clean=html.replace(/\s*<script\b[^>]*\bsrc=["']\.\/data\/shamela-search-v2-packed\.js["'][^>]*>\s*<\/script>/giu,'')
 const marker=/<script\b[^>]*\btype=["']module["']/iu
 if(!marker.test(clean))throw Error('search_bootstrap_module_missing')
 return clean.replace(marker,match=>tag+'\n    '+match)
}
export function assertSearchBootstrap(html){
 const scripts=[...html.matchAll(/<script\b([^>]*)>/giu)]
 const index=scripts.findIndex(m=>/\bsrc=["']\.\/data\/shamela-search-v2-packed\.js["']/iu.test(m[1]))
 if(index<0||scripts.filter(m=>/\bsrc=["']\.\/data\/shamela-search-v2-packed\.js["']/iu.test(m[1])).length!==1||/\b(async|defer|type)\b/iu.test(scripts[index][1])||scripts.slice(0,index).some(m=>/\btype=["']module["']/iu.test(m[1])))throw Error('search_bootstrap_missing_or_late')
}

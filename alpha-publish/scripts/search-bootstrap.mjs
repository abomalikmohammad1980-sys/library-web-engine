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
export function assertSearchBootstrap(html,{allowDeferred=false}={}){
 const scripts=[...html.matchAll(/<script\b([^>]*)>/giu)]
 const matches=m=>/\bsrc=["'](?:\.\/|\/)data\/shamela-search-v2-packed\.js["']/iu.test(m[1])
 const index=scripts.findIndex(matches),modules=scripts.filter(m=>/\btype=["']module["']/iu.test(m[1]))
 const prohibited=allowDeferred?/\b(async|type)\b/iu:/\b(async|defer|type)\b/iu
 if(index<0||scripts.filter(matches).length!==1||prohibited.test(scripts[index][1])||scripts.slice(0,index).some(m=>/\btype=["']module["']/iu.test(m[1]))||modules.length===0||modules.some(m=>/\basync\b/iu.test(m[1])))throw Error('search_bootstrap_missing_or_late')
}

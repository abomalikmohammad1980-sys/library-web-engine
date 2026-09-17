import {createHash} from 'node:crypto'
export const CANDIDATE_SCRIPT_PATH='/data/batch35-search-candidate-config.js'
export const REVIEWED_CONFIG_SHA256='eff5db5d87a16519d5e71db9b664bd3f9a411cc0ee4d605f909a2577b558afaf'
const sha=value=>createHash('sha256').update(value).digest('hex')
const attribute=(tag,name)=>tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`,'i'))?.[2]
/** Pure candidate build hook. Caller writes the returned asset/HTML before
 * service-worker stamping and final inventories. No filesystem or deployment. */
export function injectBatch35SearchCandidate({html,configSource,candidate,serverAcceptance}){
 if(candidate!=='batch35')throw Error('search_candidate_only')
 if(serverAcceptance?.PUBLIC_BOOK_SEARCH_ENABLED!=='true'||serverAcceptance?.HEADING_QUERY_ENABLED!=='0')throw Error('search_candidate_server_pair_required')
 if(typeof html!=='string'||typeof configSource!=='string'||sha(configSource)!==REVIEWED_CONFIG_SHA256)throw Error('search_candidate_config_not_reviewed')
 // Idempotent when a resumed local build passes an already-injected document.
 const clean=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,tag=>attribute(tag,'src')===CANDIDATE_SCRIPT_PATH?'':tag)
 const scripts=[...clean.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)]
 const modules=scripts.filter(match=>attribute(match[0],'type')?.toLowerCase()==='module')
 if(modules.length!==1||!/^\/assets\/[^?#]+\.js$/.test(attribute(modules[0][0],'src')??''))throw Error('search_candidate_compiled_module_required')
 const module=modules[0]
 for(const script of scripts){
  const type=attribute(script[0],'type')?.toLowerCase()
  if(type&& !['module','text/javascript','application/javascript'].includes(type))continue
  if(script!==module&&script.index>module.index)throw Error('search_candidate_late_config_script')
  const opening=script[0].slice(0,script[0].indexOf('>')+1)
  if(type!=='module'&&/\s(?:async|defer)(?:\s|=|>)/i.test(opening))throw Error('search_candidate_unordered_config_script')
 }
 const tag=`<script src="${CANDIDATE_SCRIPT_PATH}"></script>\n    `
 const output=clean.slice(0,module.index)+tag+clean.slice(module.index)
 const scriptSource=configSource+'\n// Candidate server pair asserted by the local build hook.\nglobalThis.__PUBLIC_BOOK_SEARCH_ENABLED__=true;\n'
 return{html:output,scriptPath:CANDIDATE_SCRIPT_PATH,scriptSource,scriptSha256:sha(scriptSource),candidateOnly:true,productionReady:false,requiredServerVars:{PUBLIC_BOOK_SEARCH_ENABLED:'true',HEADING_QUERY_ENABLED:'0'}}
}

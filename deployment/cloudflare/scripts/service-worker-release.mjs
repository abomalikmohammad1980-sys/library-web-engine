import {createHash} from 'node:crypto'
const marker=/^\/\/ khizana-shell-index-sha256: [a-f0-9]{64}\r?\n/gm
const digest=index=>createHash('sha256').update(index).digest('hex')
/** Stable for the same final HTML; changes even when the worker source is unchanged. */
export function stampServiceWorkerRelease(worker,index){
 if(typeof worker!=='string'||!worker.includes("self.addEventListener('install'")||typeof index!=='string'||!/<script\b[^>]*type=["']module["']/i.test(index))throw Error('worker_release_input_invalid')
 return `// khizana-shell-index-sha256: ${digest(index)}\n${worker.replace(marker,'')}`
}
export function assertServiceWorkerRelease(worker,index){
 const matches=[...worker.matchAll(marker)]
 if(matches.length!==1||matches[0][0].trim()!==`// khizana-shell-index-sha256: ${digest(index)}`)throw Error('worker_release_index_mismatch')
}

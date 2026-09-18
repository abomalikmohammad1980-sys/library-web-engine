import {readFile} from 'node:fs/promises'
export const positionFilterRoot='release-artifacts/position-filter-9d4f7e33a94719966a2efdbc43a43e60e9b45216c5d953a763571b0a3e5667c4'
export async function positionFilterConfig(origin){const f=JSON.parse(await readFile(positionFilterRoot+'/descriptor.json'));return[{...f,parts:f.parts.map(({path,...p})=>({...p,url:origin+'/library/position-filters/'+f.sha256+'/'+path}))}]}

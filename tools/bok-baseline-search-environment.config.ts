import {defineConfig} from 'vitest/config'
import {resolve} from 'node:path'
export default defineConfig({plugins:[{name:'frozen-batch33-search-baseline',enforce:'pre',resolveId(source,importer){if(source==='./shamela_search_v2'&&importer?.endsWith('/app/src/shamela_search_environment.test.ts'))return resolve('.artifacts/batch33/app/src/shamela_search_v2.ts')}}],test:{include:['app/src/shamela_search_environment.test.ts']}})

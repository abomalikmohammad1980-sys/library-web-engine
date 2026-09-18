import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'
it('retains shell ornament without an endless full-page paint animation',()=>{
 const css=readFileSync(new URL('./styles/components.css',import.meta.url),'utf8')
 const ornament=css.match(/\.app-main::before\s*\{([^}]+)\}/)?.[1]
 expect(ornament).toContain('background-image:')
 expect(ornament).toContain('mask-image:')
 expect(ornament).not.toMatch(/animation\s*:/)
 expect(css).not.toContain('@keyframes khizana-motif-drift')
})

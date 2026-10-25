import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'
const css=readFileSync(new URL('./styles/components.css',import.meta.url),'utf8')
it('keeps login usable in a stable 64px mobile header row',()=>{
 expect(css).toMatch(/\.app-header__auth\s*\{[^}]*min-height: 44px/)
 expect(css).toMatch(/\.app-header__auth\s*\{[^}]*white-space: nowrap/)
 expect(css).toMatch(/@media \(max-width: 768px\)\s*\{\s*\.app-header__inner\s*\{[^}]*flex-wrap: nowrap; height: 64px/)
})

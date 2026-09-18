import {describe,expect,it} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const home=fs.readFileSync(path.resolve(import.meta.dirname,'screens/home.ts'),'utf8')

describe('home library hydration',()=>{
  it('shares one in-flight library read across all home panels',()=>{
    expect(home).toContain('function loadHomeBooks(): Promise<StoredBook[]>')
    expect(home.match(/\blistBooks\(\)/g)).toHaveLength(1)
    for (const panel of ['hydrateRecent', 'hydrateDailyQuote', 'hydratePopular', 'hydrateNewForYou']) {
      const body = home.slice(home.indexOf(`async function ${panel}(`)).split(/\n(?:async )?function /)[0]!
      expect(body).toContain('await loadHomeBooks()')
    }
    expect(home).toContain('whenNearViewport(recommendations,')
    expect(home).toContain("window.addEventListener('library-changed', () => { homeBooksRead = undefined })")
  })
})

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {pageMetaFor} from './page_meta_model'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

describe('initial document title contract', () => {
  it('uses the approved homepage brand before and after the router starts', () => {
    const title = html.match(/<title>([^<]+)<\/title>/u)?.[1]
    expect(title).toBe('الخزانة: المكتبة الإسلامية الذكية')
    expect(title).toBe(pageMetaFor('/').title)
    expect(title).not.toMatch(/[—–]/u)
  })
})

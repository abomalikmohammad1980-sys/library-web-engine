import { describe, expect, it } from 'vitest'
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

describe('PWA install artwork', () => {
  it('declares real PNG icons for regular and maskable installation surfaces', () => {
    const root = fileURLToPath(new URL('../public/', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.webmanifest'), 'utf8')) as { icons: Array<{ src: string; sizes: string; type: string; purpose: string }> }
    for (const size of ['192x192', '512x512']) {
      for (const purpose of ['any', 'maskable']) {
        const icon = manifest.icons.find(item => item.sizes === size && item.purpose === purpose)
        expect(icon?.type).toBe('image/png')
        const bytes = readFileSync(resolve(root, icon!.src.replace(/^\.\//, '')))
        expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
        expect(statSync(resolve(root, icon!.src.replace(/^\.\//, ''))).size).toBeGreaterThan(500)
      }
    }
  })
})
